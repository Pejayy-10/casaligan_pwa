import { createClient } from './client'
import { getAdminId } from './adminQueries'

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

  // Filter out reports where reporter or reported user is an admin
  const filteredReports = reports.filter(report => {
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
  const updateData: any = {
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

