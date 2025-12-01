import { createClient } from './client'

/**
 * Activity Log queries - aggregates data from multiple tables
 */

// Get all activity logs from various sources
export async function getActivityLogs(limit = 50, offset = 0) {
  const supabase = createClient()
  
  // We'll need to combine data from multiple tables
  // Since Supabase doesn't support UNION directly in the client, we'll fetch separately and combine
  
  const activities: any[] = []
  
  // 1. Get Job Posts (Created Job Post) from forumposts
  const { data: jobPosts, error: jobPostsError } = await supabase
    .from('forumposts')
    .select(`
      post_id,
      employer_id,
      title,
      description,
      created_at,
      employers:employer_id (
        employer_id,
        user_id,
        users:user_id (
          user_id,
          name,
          role
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!jobPostsError && jobPosts) {
    jobPosts.forEach((post: any) => {
      const employer = Array.isArray(post.employers) ? post.employers[0] : post.employers
      const user = Array.isArray(employer?.users) ? employer.users[0] : employer?.users
      if (user) {
        activities.push({
          activity_id: `post_${post.post_id}`,
          user_type: user.role || 'employer',
          user_name: user.name,
          action: 'Created Job Post',
          timestamp: post.created_at,
          details: post.description || post.title || 'Looking for part-time',
          entity_type: 'forumpost',
          entity_id: post.post_id,
          user_id: user.user_id
        })
      }
    })
  }

  // 2. Get Messages (Sent Message) from messages
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select(`
      message_id,
      sender_user_id,
      conversation_id,
      sent_at,
      users:sender_user_id (
        user_id,
        name,
        role
      ),
      conversations:conversation_id (
        conversation_id
      )
    `)
    .order('sent_at', { ascending: false })
    .limit(limit)

  if (!messagesError && messages) {
    messages.forEach((message: any) => {
      const user = Array.isArray(message.users) ? message.users[0] : message.users
      if (user) {
        activities.push({
          activity_id: `message_${message.message_id}`,
          user_type: user.role || 'worker',
          user_name: user.name,
          action: 'Sent Message',
          timestamp: message.sent_at,
          details: `ChatID:${String(message.conversation_id || message.message_id).padStart(3, '0')}`,
          entity_type: 'message',
          entity_id: message.message_id,
          user_id: user.user_id
        })
      }
    })
  }

  // 3. Get Verifications (Verified Account) from verification_logs
  const { data: verificationLogs, error: verificationLogsError } = await supabase
    .from('verification_logs')
    .select(`
      log_id,
      verification_id,
      admin_id,
      new_status,
      changed_at,
      verifications:verification_id (
        verification_id,
        worker_id,
        workers:worker_id (
          worker_id,
          user_id,
          users:user_id (
            user_id,
            name,
            role
          )
        )
      ),
      admins:admin_id (
        admin_id,
        user_id,
        users:user_id (
          user_id,
          name,
          role
        )
      )
    `)
    .eq('new_status', 'accepted')
    .order('changed_at', { ascending: false })
    .limit(limit)

  if (!verificationLogsError && verificationLogs) {
    verificationLogs.forEach((log: any) => {
      const verification = Array.isArray(log.verifications) ? log.verifications[0] : log.verifications
      const worker = Array.isArray(verification?.workers) ? verification.workers[0] : verification?.workers
      const user = Array.isArray(worker?.users) ? worker.users[0] : worker?.users
      const admin = Array.isArray(log.admins) ? log.admins[0] : log.admins
      const adminUser = Array.isArray(admin?.users) ? admin.users[0] : admin?.users
      
      if (adminUser) {
        activities.push({
          activity_id: `verification_${log.log_id}`,
          user_type: adminUser.role || 'admin',
          user_name: adminUser.name,
          action: 'Verified Account',
          timestamp: log.changed_at,
          details: user?.role || 'Worker',
          entity_type: 'verification',
          entity_id: log.verification_id,
          user_id: adminUser.user_id
        })
      }
    })
  }

  // 4. Get Payments (Completed Payment) from payments
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select(`
      payment_id,
      contract_id,
      method_id,
      amount,
      status,
      payment_date,
      contracts:contract_id (
        contract_id,
        booking_id,
        bookings:booking_id (
          booking_id,
          schedule_id,
          schedules:schedule_id (
            schedule_id,
            employer_id,
            employers:employer_id (
              employer_id,
              user_id,
              users:user_id (
                user_id,
                name,
                role
              )
            )
          )
        )
      ),
      payment_methods:method_id (
        method_id,
        provider_name
      )
    `)
    .eq('status', 'completed')
    .order('payment_date', { ascending: false })
    .limit(limit)

  if (!paymentsError && payments) {
    payments.forEach((payment: any) => {
      const contract = Array.isArray(payment.contracts) ? payment.contracts[0] : payment.contracts
      const booking = Array.isArray(contract?.bookings) ? contract.bookings[0] : contract?.bookings
      const schedule = Array.isArray(booking?.schedules) ? booking.schedules[0] : booking?.schedules
      const employer = Array.isArray(schedule?.employers) ? schedule.employers[0] : schedule?.employers
      const user = Array.isArray(employer?.users) ? employer.users[0] : employer?.users
      const paymentMethod = Array.isArray(payment.payment_methods) ? payment.payment_methods[0] : payment.payment_methods
      
      if (user) {
        const amount = parseFloat(payment.amount || 0)
        const amountFormatted = `P${Math.round(amount).toLocaleString('en-US')}`
        const methodName = paymentMethod?.provider_name || 'Unknown'
        
        activities.push({
          activity_id: `payment_${payment.payment_id}`,
          user_type: user.role || 'employer',
          user_name: user.name,
          action: 'Completed Payment',
          timestamp: payment.payment_date,
          details: `${amountFormatted} via ${methodName}`,
          entity_type: 'payment',
          entity_id: payment.payment_id,
          user_id: user.user_id
        })
      }
    })
  }

  // 5. Get Profile Updates - track through package updates (workers adding skills/certifications)
  // Note: For a complete solution, you might want to add a profile_updates or activity_logs table
  // For now, we'll track profile updates through package status changes or other indicators
  
  // Get packages that were recently updated (indicating profile updates)
  const { data: packages, error: packagesError } = await supabase
    .from('packages')
    .select(`
      package_id,
      worker_id,
      title,
      description,
      status,
      created_at,
      workers:worker_id (
        worker_id,
        user_id,
        users:user_id (
          user_id,
          name,
          role
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!packagesError && packages) {
    // Track package updates as profile updates for workers
    // This is a simplified approach - in production, you'd want a dedicated activity tracking table
    packages.forEach((pkg: any) => {
      const worker = Array.isArray(pkg.workers) ? pkg.workers[0] : pkg.workers
      const user = Array.isArray(worker?.users) ? worker.users[0] : worker?.users
      if (user && pkg.status === 'approved') {
        // Only add if it's a recent update (within last 30 days)
        const packageDate = new Date(pkg.created_at)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        if (packageDate >= thirtyDaysAgo) {
          activities.push({
            activity_id: `profile_update_${pkg.package_id}`,
            user_type: user.role || 'worker',
            user_name: user.name,
            action: 'Updated Profile',
            timestamp: pkg.created_at,
            details: 'Added new skills',
            entity_type: 'package',
            entity_id: pkg.package_id,
            user_id: user.user_id
          })
        }
      }
    })
  }

  // Sort all activities by timestamp (most recent first)
  activities.sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime()
    const dateB = new Date(b.timestamp).getTime()
    return dateB - dateA
  })

  // Apply pagination
  const paginatedActivities = activities.slice(offset, offset + limit)

  return {
    data: paginatedActivities,
    count: activities.length,
    error: null
  }
}

// Get activity log analytics for charts
export async function getActivityLogAnalytics() {
  const supabase = createClient()
  
  try {
    // Get counts for Actions by Type
    const [jobPostsCount, bookingsCount, paymentsCount, messagesCount, reviewsCount] = await Promise.all([
      supabase.from('forumposts').select('*', { count: 'exact', head: true }),
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true })
    ])

    const actionsData = [
      { name: "Jobs Created", value: jobPostsCount.count || 0 },
      { name: "Bookings Made", value: bookingsCount.count || 0 },
      { name: "Payments Completed", value: paymentsCount.count || 0 },
      { name: "Messages sent", value: messagesCount.count || 0 },
      { name: "Reviews Submitted", value: reviewsCount.count || 0 },
    ]

    // Get monthly activity data (last 9 months)
    const now = new Date()
    const monthlyData: { month: string; value: number }[] = []
    
    for (let i = 8; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthName = date.toLocaleString('en-US', { month: 'short' })
      
      // Count activities in this month (from all sources)
      const [posts, bookings, payments, messages] = await Promise.all([
        supabase.from('forumposts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', date.toISOString())
          .lt('created_at', nextMonth.toISOString()),
        supabase.from('bookings')
          .select('*', { count: 'exact', head: true })
          .gte('booking_date', date.toISOString())
          .lt('booking_date', nextMonth.toISOString()),
        supabase.from('payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('payment_date', date.toISOString())
          .lt('payment_date', nextMonth.toISOString()),
        supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', date.toISOString())
          .lt('sent_at', nextMonth.toISOString())
      ])
      
      const totalActivities = 
        (posts.count || 0) + 
        (bookings.count || 0) + 
        (payments.count || 0) + 
        (messages.count || 0)
      
      monthlyData.push({
        month: monthName,
        value: totalActivities
      })
    }

    return {
      actionsData,
      activityData: monthlyData,
      error: null
    }
  } catch (error) {
    console.error('Error fetching activity log analytics:', error)
    return {
      actionsData: [
        { name: "Jobs Created", value: 0 },
        { name: "Bookings Made", value: 0 },
        { name: "Payments Completed", value: 0 },
        { name: "Messages sent", value: 0 },
        { name: "Reviews Submitted", value: 0 },
      ],
      activityData: [],
      error: error as any
    }
  }
}

// Get activity log by ID
export async function getActivityLogById(activityId: string) {
  const supabase = createClient()
  
  // Parse the activity ID to determine the type
  const [entityType, entityId] = activityId.split('_')
  
  // Fetch based on entity type
  // This is a simplified version - you might want to implement specific queries for each type
  
  return { data: null, error: null }
}

// Delete activity log entry
export async function deleteActivityLog(activityId: string) {
  const supabase = createClient()
  
  // Parse the activity ID to determine the type and ID
  const [entityType, entityId] = activityId.split('_')
  
  // Delete based on entity type
  let result
  
  switch (entityType) {
    case 'post':
      result = await supabase
        .from('forumposts')
        .delete()
        .eq('post_id', parseInt(entityId))
      break
    case 'message':
      result = await supabase
        .from('messages')
        .delete()
        .eq('message_id', parseInt(entityId))
      break
    case 'verification':
      // Don't delete verification logs, they're audit records
      return { data: null, error: { message: 'Cannot delete verification logs' } as any }
    case 'payment':
      result = await supabase
        .from('payments')
        .delete()
        .eq('payment_id', parseInt(entityId))
      break
    default:
      return { data: null, error: { message: 'Unknown activity type' } as any }
  }
  
  return result
}

