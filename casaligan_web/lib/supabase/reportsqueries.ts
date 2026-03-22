import { createClient } from './client'
import { getAdminId } from './adminQueries'

/**
 * Report-specific queries for admin dashboard
 */

// Get all reports with related information (reporter, resolver admin, target details)
export async function getReports(limit = 50, offset = 0, status?: string) {
  const supabase = createClient()
  
  // Build query with optional status filter
  let query = supabase
    .from('reports')
    .select('report_id, reporter_user_id, target_type, target_id, reason, status, created_at, resolved_at, resolver_admin_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply status filter if provided
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: reports, error: reportsError, count } = await query

  if (reportsError) {
    console.error('Error fetching reports:', reportsError)
    return { data: [], count: 0, error: reportsError }
  }

  if (!reports || reports.length === 0) {
    return { data: [], count: count || 0, error: null }
  }

  // Get reporter user IDs and fetch users
  const reporterUserIds = reports.map(r => r.reporter_user_id).filter(Boolean)
  const { data: reporterUsers, error: reporterUsersError } = await supabase
    .from('users')
    .select('user_id, name, email, phone_number, status, created_at, profile_picture')
    .in('user_id', reporterUserIds)

  if (reporterUsersError) {
    console.error('Error fetching reporter users:', reporterUsersError)
    return { data: reports.map(r => ({ ...r, reporter: null, resolver: null })), count: count || 0, error: null }
  }

  // Get resolver admin IDs and fetch admins
  const resolverAdminIds = reports.map(r => r.resolver_admin_id).filter(Boolean)
  let resolverAdmins: any[] = []
  if (resolverAdminIds.length > 0) {
    const { data: admins, error: adminsError } = await supabase
      .from('admins')
      .select('admin_id, user_id')
      .in('admin_id', resolverAdminIds)

    if (!adminsError && admins) {
      const adminUserIds = admins.map(a => a.user_id).filter(Boolean)
      const { data: adminUsers, error: adminUsersError } = await supabase
        .from('users')
        .select('user_id, name, email, phone_number, status, created_at, profile_picture')
        .in('user_id', adminUserIds)

      if (!adminUsersError && adminUsers) {
        resolverAdmins = admins.map(admin => {
          const user = adminUsers.find(u => u.user_id === admin.user_id)
          return { ...admin, users: user }
        })
      }
    }
  }

  // Get target user IDs based on target_type and target_id
  const targetUserIds: number[] = []
  const targetUserMap: { [key: number]: number } = {} // target_id -> user_id mapping
  
  // Group reports by target_type
  const userReports = reports.filter(r => r.target_type === 'user')
  const reviewReports = reports.filter(r => r.target_type === 'review')
  const messageReports = reports.filter(r => r.target_type === 'message')
  
  // For user reports, target_id is the user_id
  userReports.forEach(r => {
    if (r.target_id) {
      targetUserIds.push(r.target_id)
      targetUserMap[r.target_id] = r.target_id
    }
  })
  
  // For review reports, get reviewer_user_id from reviews table
  if (reviewReports.length > 0) {
    const reviewIds = reviewReports.map(r => r.target_id).filter(Boolean)
    const { data: reviewData, error: reviewError } = await supabase
      .from('reviews')
      .select('review_id, reviewer_user_id')
      .in('review_id', reviewIds)
    
    if (!reviewError && reviewData) {
      reviewData.forEach(review => {
        if (review.reviewer_user_id) {
          targetUserIds.push(review.reviewer_user_id)
          targetUserMap[review.review_id] = review.reviewer_user_id
        }
      })
    }
  }
  
  // For message reports, get sender_user_id from messages table
  if (messageReports.length > 0) {
    const messageIds = messageReports.map(r => r.target_id).filter(Boolean)
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .select('message_id, sender_user_id')
      .in('message_id', messageIds)
    
    if (!messageError && messageData) {
      messageData.forEach(message => {
        if (message.sender_user_id) {
          targetUserIds.push(message.sender_user_id)
          targetUserMap[message.message_id] = message.sender_user_id
        }
      })
    }
  }
  
  // Fetch target users
  const uniqueTargetUserIds = [...new Set(targetUserIds)]
  let targetUsers: any[] = []
  if (uniqueTargetUserIds.length > 0) {
    const { data: targetUsersData, error: targetUsersError } = await supabase
      .from('users')
      .select('user_id, name, email, phone_number, status, created_at, profile_picture')
      .in('user_id', uniqueTargetUserIds)
    
    if (!targetUsersError && targetUsersData) {
      targetUsers = targetUsersData
    }
  }

  // Combine all data
  const reportsWithDetails = reports.map(report => {
    const reporter = reporterUsers?.find(u => u.user_id === report.reporter_user_id) || null
    const resolver = resolverAdmins?.find(a => a.admin_id === report.resolver_admin_id) || null
    
    // Find target user based on target_type and target_id
    // Create a fresh copy to avoid reference sharing
    let targetUser = null
    const mappedUserId = targetUserMap[report.target_id]
    if (mappedUserId) {
      const foundUser = targetUsers.find(u => u.user_id === mappedUserId) || null
      if (foundUser) {
        // Create a completely fresh copy with all properties
        // Use JSON serialization to ensure deep copy and break any references
        // This ensures each report gets its own independent copy
        const userCopy = JSON.parse(JSON.stringify(foundUser))
        targetUser = {
          user_id: Number(userCopy.user_id),
          name: String(userCopy.name || ''),
          email: String(userCopy.email || ''),
          phone_number: userCopy.phone_number ? String(userCopy.phone_number) : null,
          status: userCopy.status ? String(userCopy.status) : 'active', // Force to string primitive
          created_at: userCopy.created_at,
          profile_picture: userCopy.profile_picture ? String(userCopy.profile_picture) : null,
        }
      }
    }

    return {
      ...report,
      reporter: reporter,
      resolver: resolver,
      target_user: targetUser,
    }
  })

  return { data: reportsWithDetails, count: count || 0, error: null }
}

// Get report analytics for charts
export async function getReportAnalytics() {
  const supabase = createClient()
  
  // Get all reports
  const { data: reports, error: reportsError } = await supabase
    .from('reports')
    .select('report_id, status, reason, target_type, created_at')

  if (reportsError) {
    console.error('Error fetching report analytics:', reportsError)
    return {
      totalReports: 0,
      pending: 0,
      resolved: 0,
      escalated: 0,
      distributionData: [],
      error: reportsError
    }
  }

  // Calculate status counts
  const totalReports = reports?.length || 0
  const pending = reports?.filter(r => r.status === 'open' || r.status === 'pending').length || 0
  const resolved = reports?.filter(r => r.status === 'resolved' || r.status === 'closed').length || 0
  const escalated = reports?.filter(r => r.status === 'escalated').length || 0

  // Group by reason for distribution chart
  const reasonCounts: { [key: string]: number } = {}
  reports?.forEach(report => {
    // Use reason if available, otherwise use target_type
    const key = report.reason || report.target_type || 'Others'
    // Truncate long reasons
    const displayKey = key.length > 30 ? key.substring(0, 30) + '...' : key
    reasonCounts[displayKey] = (reasonCounts[displayKey] || 0) + 1
  })

  // Convert to array format and sort by count
  const distributionData = Object.entries(reasonCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10) // Top 10 reasons

  return {
    totalReports,
    pending,
    resolved,
    escalated,
    distributionData,
    error: null
  }
}

// Update report status
export async function updateReportStatus(reportId: number, status: string, resolverAdminId?: number) {
  const supabase = createClient()
  
  const updateData: any = { status }
  if (status === 'resolved' || status === 'closed' || status === 'dismissed') {
    updateData.resolved_at = new Date().toISOString()
    if (resolverAdminId) {
      updateData.resolver_admin_id = resolverAdminId
    }
  }

  const { data, error } = await supabase
    .from('reports')
    .update(updateData)
    .eq('report_id', reportId)
    .select()
  
  return { data, error }
}

// Delete report
export async function deleteReport(reportId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('reports')
    .delete()
    .eq('report_id', reportId)
    .select()
  
  return { data, error }
}

// Get target user ID from report
async function getTargetUserIdFromReport(reportId: number): Promise<{ userId: number | null, error: any }> {
  const supabase = createClient()
  
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('target_type, target_id')
    .eq('report_id', reportId)
    .single()
  
  if (reportError || !report) {
    return { userId: null, error: reportError }
  }
  
  const targetType = String(report.target_type).toLowerCase()
  
  // If target_type is 'user', target_id is the user_id
  if (targetType === 'user') {
    return { userId: report.target_id, error: null }
  }
  
  // If target_type is 'review', get reviewer_user_id
  if (targetType === 'review') {
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('reviewer_user_id')
      .eq('review_id', report.target_id)
      .single()
    
    if (reviewError || !review) {
      return { userId: null, error: reviewError }
    }
    
    return { userId: review.reviewer_user_id, error: null }
  }
  
  // If target_type is 'message', get sender_user_id
  if (targetType === 'message') {
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('sender_user_id')
      .eq('message_id', report.target_id)
      .single()
    
    if (messageError || !message) {
      return { userId: null, error: messageError }
    }
    
    return { userId: message.sender_user_id, error: null }
  }
  
  // Handle other possible target_types (case-insensitive)
  // For now, if we can't determine, try to use target_id as user_id as fallback
  // This handles cases where target_type might be something else but target_id is still a user_id
  console.warn(`Unknown target_type: ${report.target_type}, attempting to use target_id as user_id`)
  
  // Try to verify if target_id is a valid user_id
  const { data: userCheck, error: userCheckError } = await supabase
    .from('users')
    .select('user_id')
    .eq('user_id', report.target_id)
    .single()
  
  if (!userCheckError && userCheck) {
    // target_id is a valid user_id, use it
    return { userId: report.target_id, error: null }
  }
  
  return { 
    userId: null, 
    error: new Error(`Unknown target_type: ${report.target_type}. Cannot determine target user.`) 
  }
}

// Warn user from report
export async function warnUserFromReport(reportId: number, violationType: string, notes?: string) {
  const supabase = createClient()
  
  // Get admin ID
  const { admin_id, error: adminError } = await getAdminId()
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error('Admin not authenticated') }
  }
  
  // First, try to get the report with target_user already loaded
  const { data: reportWithTarget, error: reportError } = await supabase
    .from('reports')
    .select('target_type, target_id')
    .eq('report_id', reportId)
    .single()
  
  let userId: number | null = null
  
  // Try to get target user ID from the report we already have loaded
  // This is more efficient than re-fetching
  if (!reportError && reportWithTarget) {
    const targetType = String(reportWithTarget.target_type).toLowerCase()
    
    if (targetType === 'user') {
      userId = reportWithTarget.target_id
    } else {
      // For other types, use the helper function
      const result = await getTargetUserIdFromReport(reportId)
      userId = result.userId
      if (result.error) {
        return { data: null, error: result.error }
      }
    }
  } else {
    // Fallback to helper function
    const { userId: fetchedUserId, error: userIdError } = await getTargetUserIdFromReport(reportId)
    if (userIdError || !fetchedUserId) {
      return { data: null, error: userIdError || new Error('Could not find target user') }
    }
    userId = fetchedUserId
  }
  
  if (!userId) {
    return { data: null, error: new Error('Could not determine target user ID') }
  }
  
  // Create notification for the user
  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'warning',
      entity_type: 'report',
      entity_id: reportId,
      content: `Policy Violation Warning: You have received a warning for ${violationType}. ${notes || ''}`,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (notificationError) {
    return { data: null, error: notificationError }
  }
  
  // Update report status to resolved
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolver_admin_id: admin_id,
    })
    .eq('report_id', reportId)
  
  if (updateError) {
    return { data: null, error: updateError }
  }
  
  return { data: { notification, userId }, error: null }
}

// Restrict user from report
export async function restrictUserFromReport(reportId: number) {
  const supabase = createClient()
  
  // Get admin ID
  const { admin_id, error: adminError } = await getAdminId()
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error('Admin not authenticated') }
  }
  
  // First, try to get the report with target_user already loaded
  const { data: reportWithTarget, error: reportError } = await supabase
    .from('reports')
    .select('target_type, target_id')
    .eq('report_id', reportId)
    .single()
  
  let userId: number | null = null
  
  // Try to get target user ID from the report we already have loaded
  if (!reportError && reportWithTarget) {
    const targetType = String(reportWithTarget.target_type).toLowerCase()
    
    if (targetType === 'user') {
      userId = reportWithTarget.target_id
    } else {
      // For other types, use the helper function
      const result = await getTargetUserIdFromReport(reportId)
      userId = result.userId
      if (result.error) {
        return { data: null, error: result.error }
      }
    }
  } else {
    // Fallback to helper function
    const { userId: fetchedUserId, error: userIdError } = await getTargetUserIdFromReport(reportId)
    if (userIdError || !fetchedUserId) {
      return { data: null, error: userIdError || new Error('Could not find target user') }
    }
    userId = fetchedUserId
  }
  
  if (!userId) {
    return { data: null, error: new Error('Could not determine target user ID') }
  }
  
  // Update user status to restricted
  const { data: userUpdate, error: userError } = await supabase
    .from('users')
    .update({ status: 'restricted' })
    .eq('user_id', userId)
    .select()
    .single()
  
  if (userError) {
    return { data: null, error: userError }
  }
  
  // Create notification for the user
  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'restriction',
      entity_type: 'report',
      entity_id: reportId,
      content: `Your account has been restricted due to a report. Please contact support for more information.`,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (notificationError) {
    console.error('Error creating notification:', notificationError)
  }
  
  // Update report status to restricted
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'restricted',
      resolved_at: new Date().toISOString(),
      resolver_admin_id: admin_id,
    })
    .eq('report_id', reportId)
  
  if (updateError) {
    return { data: null, error: updateError }
  }
  
  return { data: { user: userUpdate, notification }, error: null }
}

// Unrestrict user from report
export async function unrestrictUserFromReport(reportId: number) {
  const supabase = createClient()
  
  // Get admin ID
  const { admin_id, error: adminError } = await getAdminId()
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error('Admin not authenticated') }
  }
  
  // First, try to get the report with target_user already loaded
  const { data: reportWithTarget, error: reportError } = await supabase
    .from('reports')
    .select('target_type, target_id')
    .eq('report_id', reportId)
    .single()
  
  let userId: number | null = null
  
  // Try to get target user ID from the report we already have loaded
  if (!reportError && reportWithTarget) {
    const targetType = String(reportWithTarget.target_type).toLowerCase()
    
    if (targetType === 'user') {
      userId = reportWithTarget.target_id
    } else {
      // For other types, use the helper function
      const result = await getTargetUserIdFromReport(reportId)
      userId = result.userId
      if (result.error) {
        return { data: null, error: result.error }
      }
    }
  } else {
    // Fallback to helper function
    const { userId: fetchedUserId, error: userIdError } = await getTargetUserIdFromReport(reportId)
    if (userIdError || !fetchedUserId) {
      return { data: null, error: userIdError || new Error('Could not find target user') }
    }
    userId = fetchedUserId
  }
  
  if (!userId) {
    return { data: null, error: new Error('Could not determine target user ID') }
  }
  
  // Update user status back to active
  const { data: userUpdate, error: userError } = await supabase
    .from('users')
    .update({ status: 'active' })
    .eq('user_id', userId)
    .select()
    .single()
  
  if (userError) {
    return { data: null, error: userError }
  }
  
  // Create notification for the user
  const { data: notification, error: notificationError } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'info',
      entity_type: 'report',
      entity_id: reportId,
      content: 'Restriction Removed: Your account restrictions have been removed. You now have full access to your account.',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()
  
  if (notificationError) {
    console.error('Error creating notification:', notificationError)
  }
  
  // Update report status back to open when user is unrestricted
  const { error: updateError } = await supabase
    .from('reports')
    .update({
      status: 'open',
      resolved_at: null,
      resolver_admin_id: null,
    })
    .eq('report_id', reportId)
  
  if (updateError) {
    console.error('Error updating report status:', updateError)
  }
  
  return { data: { user: userUpdate, notification }, error: null }
}

