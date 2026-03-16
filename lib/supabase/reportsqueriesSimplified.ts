import { createClient } from './client'
import { getAdminId } from './adminQueries'

const BACK_JOB_SLA_HOURS = 48
const BACK_JOB_ESCALATION_MARKER = '[BACK_JOB_SLA_ESCALATED]'

async function autoEscalateOverdueBackJobs(reports: any[]) {
  const supabase = createClient()

  const now = new Date()
  const candidates = reports.filter((report) => {
    if (report.report_type !== 'back_job_request') return false
    if (report.status !== 'resolved') return false
    if (!report.post_id) return false
    if (!report.resolved_at) return false

    const resolvedAt = new Date(report.resolved_at)
    if (Number.isNaN(resolvedAt.getTime())) return false

    const hoursSinceResolution = (now.getTime() - resolvedAt.getTime()) / (1000 * 60 * 60)
    return hoursSinceResolution >= BACK_JOB_SLA_HOURS
  })

  if (candidates.length === 0) {
    return reports
  }

  const postIds = [...new Set(candidates.map((c) => c.post_id).filter(Boolean))]
  const { data: posts } = await supabase
    .from('forumposts')
    .select('post_id, status')
    .in('post_id', postIds)

  const postStatusMap = new Map<number, string>()
  ;(posts || []).forEach((post: any) => {
    postStatusMap.set(post.post_id, String(post.status || '').toLowerCase())
  })

  const escalatedIds = new Set<number>()

  for (const report of candidates) {
    const postStatus = postStatusMap.get(report.post_id)

    // If job is already completed again, SLA is considered satisfied
    if (postStatus === 'completed') {
      continue
    }

    const previousNotes = report.admin_notes || ''
    if (String(previousNotes).includes(BACK_JOB_ESCALATION_MARKER)) {
      escalatedIds.add(report.report_id)
      continue
    }

    const escalationNote = `${previousNotes ? `${previousNotes}\n\n` : ''}${BACK_JOB_ESCALATION_MARKER} Back-job SLA breached: no completed rework within ${BACK_JOB_SLA_HOURS} hours.`

    const { error: updateError } = await supabase
      .from('reports')
      .update({
        status: 'escalated',
        admin_notes: escalationNote,
      })
      .eq('report_id', report.report_id)

    if (!updateError) {
      escalatedIds.add(report.report_id)

      const notifications: any[] = []
      const nowIso = new Date().toISOString()

      if (report.reporter_id) {
        notifications.push({
          user_id: report.reporter_id,
          type: 'system',
          title: 'Back Job Escalated',
          message: 'Your back-job request has been escalated because the rework was not completed within 48 hours.',
          content: 'Back job escalated due to SLA breach.',
          entity_type: 'report',
          entity_id: report.report_id,
          created_at: nowIso,
        })
      }

      if (report.reported_user_id) {
        notifications.push({
          user_id: report.reported_user_id,
          type: 'system',
          title: 'Back Job Escalated',
          message: 'A back-job assigned to you was escalated due to missed rework SLA.',
          content: 'Back job escalated due to missed SLA.',
          entity_type: 'report',
          entity_id: report.report_id,
          created_at: nowIso,
        })
      }

      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications)
      }
    }
  }

  if (escalatedIds.size === 0) {
    return reports
  }

  return reports.map((report) => {
    if (!escalatedIds.has(report.report_id)) return report
    return {
      ...report,
      status: 'escalated',
      admin_notes: `${report.admin_notes ? `${report.admin_notes}\n\n` : ''}${BACK_JOB_ESCALATION_MARKER} Back-job SLA breached: no completed rework within ${BACK_JOB_SLA_HOURS} hours.`,
    }
  })
}

/**
 * SIMPLIFIED Report queries for admin dashboard
 * Works with the new simplified reports table structure
 */

// Get all reports with user details
export async function getReports(limit = 50, offset = 0, status?: string) {
  const supabase = createClient()
  
  // Build query with optional status filter
  let query = supabase
    .from('reports')
    .select(`
      report_id,
      reporter_id,
      reported_user_id,
      post_id,
      report_type,
      title,
      reason,
      description,
      evidence_urls,
      status,
      created_at,
      resolved_at,
      resolved_by_admin_id,
      admin_notes,
      reporter:users!reports_reporter_id_fkey (
        id,
        first_name,
        last_name,
        email,
        active_role,
        status,
        phone_number,
        is_restricted,
        restriction_reason,
        restriction_start,
        restriction_end
      ),
      reported_user:users!reports_reported_user_id_fkey (
        id,
        first_name,
        last_name,
        email,
        active_role,
        status,
        phone_number,
        is_restricted,
        restriction_reason,
        restriction_start,
        restriction_end
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply status filter if provided
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: reports, error, count } = await query

  if (error) {
    console.error('Error fetching reports:', error)
    return { data: [], count: 0, error }
  }

  if (!reports || reports.length === 0) {
    return { data: [], count: count || 0, error: null }
  }

  const reportsAfterSlaCheck = await autoEscalateOverdueBackJobs(reports)

  // Filter out reports where reporter or reported user is an admin
  const filteredReports = reportsAfterSlaCheck.filter(report => {
    const reporterRole = report.reporter?.active_role
    const reportedRole = report.reported_user?.active_role
    return (
      reporterRole && ['owner', 'housekeeper'].includes(reporterRole) &&
      reportedRole && ['owner', 'housekeeper'].includes(reportedRole)
    )
  })

  return { data: filteredReports, count: filteredReports.length, error: null }
}

// Get report analytics for dashboard
export async function getReportAnalytics() {
  const supabase = createClient()
  
  const { data: reports, error } = await supabase
    .from('reports')
    .select('report_id, status, reason, created_at')

  if (error) {
    console.error('Error fetching report analytics:', error)
    return {
      totalReports: 0,
      pending: 0,
      resolved: 0,
      dismissed: 0,
      distributionData: [],
      error
    }
  }

  const totalReports = reports?.length || 0
  const pending = reports?.filter(r => r.status === 'pending').length || 0
  const resolved = reports?.filter(r => r.status === 'resolved').length || 0
  const dismissed = reports?.filter(r => r.status === 'dismissed').length || 0

  // Group by reason for distribution chart
  const reasonCounts: { [key: string]: number } = {}
  reports?.forEach(report => {
    const reason = report.reason || 'Other'
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
  })

  const distributionData = Object.entries(reasonCounts).map(([name, value]) => ({
    name,
    value
  }))

  return {
    totalReports,
    pending,
    resolved,
    dismissed,
    distributionData,
    error: null
  }
}

// Resolve a report
export async function resolveReport(reportId: number, adminNotes?: string) {
  const supabase = createClient()
  
  const { admin_id, error: adminError } = await getAdminId()
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error('Admin not authenticated') }
  }

  const { data, error } = await supabase
    .from('reports')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: admin_id,
      admin_notes: adminNotes || null
    })
    .eq('report_id', reportId)
    .select()
    .single()

  return { data, error }
}

// Dismiss a report
export async function dismissReport(reportId: number, adminNotes?: string) {
  const supabase = createClient()
  
  const { admin_id, error: adminError } = await getAdminId()
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error('Admin not authenticated') }
  }

  const { data, error } = await supabase
    .from('reports')
    .update({
      status: 'dismissed',
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: admin_id,
      admin_notes: adminNotes || null
    })
    .eq('report_id', reportId)
    .select()
    .single()

  return { data, error }
}

// Approve a back-job request (free rework)
export async function approveBackJobReport(reportId: number, adminNotes?: string) {
  const supabase = createClient()

  const { admin_id, error: adminError } = await getAdminId()
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error('Admin not authenticated') }
  }

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('report_id, post_id, reporter_id, reported_user_id, report_type, status')
    .eq('report_id', reportId)
    .single()

  if (reportError || !report) {
    return { data: null, error: reportError || new Error('Report not found') }
  }

  if (report.report_type !== 'back_job_request') {
    return { data: null, error: new Error('Report is not a back job request') }
  }

  if (!report.post_id) {
    return { data: null, error: new Error('Back job report has no related job post') }
  }

  // Reopen the job for free rework (no new payment schedule is created).
  const { error: postUpdateError } = await supabase
    .from('forumposts')
    .update({
      status: 'ongoing',
      completed_at: null,
      completion_proof_url: null,
      completion_notes: null,
    })
    .eq('post_id', report.post_id)

  if (postUpdateError) {
    return { data: null, error: postUpdateError }
  }

  // If we can identify the reported housekeeper's worker record, reopen their contract too.
  if (report.reported_user_id) {
    const { data: worker } = await supabase
      .from('workers')
      .select('worker_id')
      .eq('user_id', report.reported_user_id)
      .maybeSingle()

    if (worker?.worker_id) {
      await supabase
        .from('contracts')
        .update({
          status: 'active',
          completed_at: null,
          completion_proof_url: null,
          completion_notes: null,
        })
        .eq('post_id', report.post_id)
        .eq('worker_id', worker.worker_id)
    }
  }

  const notes = adminNotes || 'Back job approved. Housekeeper must perform free rework. No additional payment required.'
  const { data, error } = await supabase
    .from('reports')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: admin_id,
      admin_notes: notes,
    })
    .eq('report_id', reportId)
    .select()
    .single()

  if (error) {
    return { data: null, error }
  }

  const nowIso = new Date().toISOString()
  const notifications: any[] = []

  if (report.reporter_id) {
    notifications.push({
      user_id: report.reporter_id,
      type: 'system',
      title: 'Back Job Approved',
      message: 'Your back job request was approved. The job is reopened for free rework.',
      content: 'Back job approved: job reopened for free rework.',
      entity_type: 'report',
      entity_id: reportId,
      created_at: nowIso,
    })
  }

  if (report.reported_user_id) {
    notifications.push({
      user_id: report.reported_user_id,
      type: 'system',
      title: 'Back Job Required',
      message: 'Admin approved a back job request. Please complete the rework. This is free rework (no additional payment).',
      content: 'Back job required: free rework approved by admin.',
      entity_type: 'report',
      entity_id: reportId,
      created_at: nowIso,
    })
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications)
  }

  return { data, error: null }
}

// Restrict the reported user
// Requires: Run the migration script add-restriction-reason-to-users.sql to add the restriction_reason field
export async function restrictReportedUser(reportId: number, reason: string, days?: number | null) {
  const supabase = createClient()
  
  // Get admin ID for auth
  const { admin_id, error: adminError } = await getAdminId()
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error('Admin not authenticated') }
  }

  // Get the report to find the reported user
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('reported_user_id')
    .eq('report_id', reportId)
    .single()

  if (reportError || !report) {
    return { data: null, error: reportError || new Error('Report not found') }
  }

  // Calculate restriction dates
  const now = new Date()
  let restriction_end = null
  
  if (days && days > 0) {
    restriction_end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  }

  // Update the user directly in Supabase with new restriction fields
  const updateData: Record<string, boolean | string | number | null> = {
    is_restricted: true,
    restriction_reason: reason,
    restriction_start: now.toISOString(),
    restriction_end: restriction_end ? restriction_end.toISOString() : null,
    restricted_by_admin_id: admin_id
    // Note: status field stays as 'active' or 'suspended', is_restricted is the main flag
  }

  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', report.reported_user_id)
    .select()
    .single()

  if (error) {
    console.error('Error updating user:', error)
    return { data: null, error }
  }

  // Create notification for the user
  const durationType = days && days > 0 ? `for ${days} days` : 'permanently'
  await supabase
    .from('notifications')
    .insert({
      user_id: report.reported_user_id,
      type: 'system',
      title: 'Account Restricted',
      message: `Your account has been restricted ${durationType}. Reason: ${reason}. Please contact support for more information.`,
      content: `Account restricted ${durationType}: ${reason}`,
      entity_type: 'report',
      entity_id: reportId,
      created_at: new Date().toISOString(),
    })

  return { data, error: null }
}

// Warn the reported user
export async function warnReportedUser(reportId: number, reason: string) {
  const supabase = createClient()
  
  // Get admin ID
  const { admin_id, error: adminError } = await getAdminId()
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error('Admin not authenticated') }
  }

  // Get the report to find the reported user
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('reported_user_id, reason')
    .eq('report_id', reportId)
    .single()

  if (reportError || !report) {
    return { data: null, error: reportError || new Error('Report not found') }
  }

  // Create notification for the user with the warning reason
  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: report.reported_user_id,
      type: 'system',
      title: 'Policy Violation Warning',
      message: `You have received a warning regarding a report. Reason: ${reason}. Please review our community guidelines to avoid further action.`,
      content: `Policy Violation Warning: ${reason}`,
      entity_type: 'report',
      entity_id: reportId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (notificationError) {
    return { data: null, error: notificationError }
  }

  // Update report status to resolved and store warning reason in admin_notes
  const { data: updatedReport, error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by_admin_id: admin_id,
      admin_notes: `Warning issued. Reason: ${reason}`,
    })
    .eq('report_id', reportId)
    .select()
    .single()

  if (updateError) {
    return { data: null, error: updateError }
  }

  return { data: { notification, report: updatedReport }, error: null }
}

// Unrestrict the reported user
export async function unrestrictReportedUser(reportId: number) {
  const supabase = createClient()
  
  // Get the report to find the reported user
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('reported_user_id')
    .eq('report_id', reportId)
    .single()

  if (reportError || !report) {
    return { data: null, error: reportError || new Error('Report not found') }
  }

  // Update the reported user's status to active and clear restriction data
  const { data, error } = await supabase
    .from('users')
    .update({
      is_restricted: false,
      restriction_reason: null,
      restriction_start: null,
      restriction_end: null,
      restricted_by_admin_id: null
    })
    .eq('id', report.reported_user_id)
    .select()
    .single()

  if (error) {
    return { data: null, error }
  }

  // Create notification for the user
  await supabase
    .from('notifications')
    .insert({
      user_id: report.reported_user_id,
      type: 'info',
      entity_type: 'report',
      entity_id: reportId,
      content: 'Restriction Removed: Your account restrictions have been removed. You now have full access to your account.',
      created_at: new Date().toISOString(),
    })

  return { data, error: null }
}

// Delete a report (only for testing/cleanup)
export async function deleteReport(reportId: number) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('report_id', reportId)

  return { error }
}

