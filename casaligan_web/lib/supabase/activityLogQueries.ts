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
          id,
          first_name,
          last_name,
          active_role
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
          user_type: user.active_role || 'employer',
          user_name: `${user.first_name} ${user.last_name}`,
          action: 'Created Job Post',
          timestamp: post.created_at,
          details: post.description || post.title || 'Looking for part-time',
          entity_type: 'forumpost',
          entity_id: post.post_id,
          user_id: user.id
        })
      }
    })
  }

  // 2. Get Messages (Sent Message) from messages
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select(`
      message_id,
      sender_id,
      conversation_id,
      sent_at,
      users:sender_id (
        id,
        first_name,
        last_name,
        active_role
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
          user_type: user.active_role || 'worker',
          user_name: `${user.first_name} ${user.last_name}`,
          action: 'Sent Message',
          timestamp: message.sent_at,
          details: `ChatID:${String(message.conversation_id || message.message_id).padStart(3, '0')}`,
          entity_type: 'message',
          entity_id: message.message_id,
          user_id: user.id
        })
      }
    })
  }

  // 3. Get Verifications (Verified Account) from user_documents
  const { data: verifications, error: verificationsError } = await supabase
    .from('user_documents')
    .select(`
      document_id,
      user_id,
      document_type,
      status,
      uploaded_at,
      reviewed_at,
      users:user_id (
        id,
        first_name,
        last_name,
        active_role
      )
    `)
    .eq('status', 'approved')
    .not('reviewed_at', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(limit)

  if (!verificationsError && verifications) {
    verifications.forEach((doc: any) => {
      const user = Array.isArray(doc.users) ? doc.users[0] : doc.users
      
      if (user) {
        activities.push({
          activity_id: `verification_${doc.document_id}`,
          user_type: 'admin',
          user_name: 'Admin',
          action: 'Verified Account',
          timestamp: doc.reviewed_at,
          details: `${user.first_name} ${user.last_name} - ${doc.document_type}`,
          entity_type: 'verification',
          entity_id: doc.document_id,
          user_id: user.id
        })
      }
    })
  }

  // 4. Get Completed Contracts and Direct Hires (Completed Payment)
  const [contractsData, directHiresData] = await Promise.all([
    supabase.from('contracts')
      .select(`
        contract_id,
        employer_id,
        paid_at,
        employers:employer_id (
          employer_id,
          user_id,
          users:user_id (
            id,
            first_name,
            last_name,
            active_role
          )
        )
      `)
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false })
      .limit(limit),
    supabase.from('direct_hires')
      .select(`
        hire_id,
        employer_id,
        total_amount,
        paid_at,
        payment_method,
        employers:employer_id (
          employer_id,
          user_id,
          users:user_id (
            id,
            first_name,
            last_name,
            active_role
          )
        )
      `)
      .not('paid_at', 'is', null)
      .order('paid_at', { ascending: false })
      .limit(limit)
  ])

  if (!contractsData.error && contractsData.data) {
    contractsData.data.forEach((contract: any) => {
      const employer = Array.isArray(contract.employers) ? contract.employers[0] : contract.employers
      const user = Array.isArray(employer?.users) ? employer.users[0] : employer?.users
      
      if (user) {
        activities.push({
          activity_id: `contract_${contract.contract_id}`,
          user_type: user.active_role || 'employer',
          user_name: `${user.first_name} ${user.last_name}`,
          action: 'Completed Payment',
          timestamp: contract.paid_at,
          details: 'Contract payment completed',
          entity_type: 'contract',
          entity_id: contract.contract_id,
          user_id: user.id
        })
      }
    })
  }

  if (!directHiresData.error && directHiresData.data) {
    directHiresData.data.forEach((hire: any) => {
      const employer = Array.isArray(hire.employers) ? hire.employers[0] : hire.employers
      const user = Array.isArray(employer?.users) ? employer.users[0] : employer?.users
      
      if (user) {
        const amount = parseFloat(hire.total_amount || 0)
        const amountFormatted = `P${Math.round(amount).toLocaleString('en-US')}`
        const methodName = hire.payment_method || 'Unknown'
        
        activities.push({
          activity_id: `hire_${hire.hire_id}`,
          user_type: user.active_role || 'employer',
          user_name: `${user.first_name} ${user.last_name}`,
          action: 'Completed Payment',
          timestamp: hire.paid_at,
          details: `${amountFormatted} via ${methodName}`,
          entity_type: 'direct_hire',
          entity_id: hire.hire_id,
          user_id: user.id
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
          id,
          first_name,
          last_name,
          active_role
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
            user_type: user.active_role || 'worker',
            user_name: `${user.first_name} ${user.last_name}`,
            action: 'Updated Profile',
            timestamp: pkg.created_at,
            details: 'Added new skills',
            entity_type: 'package',
            entity_id: pkg.package_id,
            user_id: user.id
          })
        }
      }
    })
  }

  // 6. Get Worker Accepted Contracts
  const { data: acceptedContracts, error: acceptedContractsError } = await supabase
    .from('contracts')
    .select(`
      contract_id,
      worker_id,
      status,
      updated_at,
      created_at,
      workers:worker_id (
        worker_id,
        user_id,
        users:user_id (
          id,
          first_name,
          last_name,
          active_role
        )
      )
    `)
    .in('status', ['accepted', 'in_progress', 'completed'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!acceptedContractsError && acceptedContracts) {
    acceptedContracts.forEach((contract: any) => {
      const worker = Array.isArray(contract.workers) ? contract.workers[0] : contract.workers
      const user = Array.isArray(worker?.users) ? worker.users[0] : worker?.users
      
      if (user) {
        activities.push({
          activity_id: `contract_accept_${contract.contract_id}`,
          user_type: user.active_role || 'housekeeper',
          user_name: `${user.first_name} ${user.last_name}`,
          action: 'Accepted Job',
          timestamp: contract.updated_at || contract.created_at,
          details: `Contract #${contract.contract_id}`,
          entity_type: 'contract',
          entity_id: contract.contract_id,
          user_id: user.id
        })
      }
    })
  }

  // 7. Get Worker Accepted Direct Hires
  const { data: acceptedHires, error: acceptedHiresError } = await supabase
    .from('direct_hires')
    .select(`
      hire_id,
      worker_id,
      status,
      updated_at,
      created_at,
      workers:worker_id (
        worker_id,
        user_id,
        users:user_id (
          id,
          first_name,
          last_name,
          active_role
        )
      )
    `)
    .in('status', ['accepted', 'in_progress', 'completed'])
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (!acceptedHiresError && acceptedHires) {
    acceptedHires.forEach((hire: any) => {
      const worker = Array.isArray(hire.workers) ? hire.workers[0] : hire.workers
      const user = Array.isArray(worker?.users) ? worker.users[0] : worker?.users
      
      if (user) {
        activities.push({
          activity_id: `hire_accept_${hire.hire_id}`,
          user_type: user.active_role || 'housekeeper',
          user_name: `${user.first_name} ${user.last_name}`,
          action: 'Accepted Booking',
          timestamp: hire.updated_at || hire.created_at,
          details: `Direct Hire #${hire.hire_id}`,
          entity_type: 'direct_hire',
          entity_id: hire.hire_id,
          user_id: user.id
        })
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
    const [jobPostsCount, contractsCount, directHiresCount, paidContractsCount, paidHiresCount, messagesCount, reviewsCount] = await Promise.all([
      supabase.from('forumposts').select('*', { count: 'exact', head: true }),
      supabase.from('contracts').select('*', { count: 'exact', head: true }),
      supabase.from('direct_hires').select('*', { count: 'exact', head: true }),
      supabase.from('contracts').select('*', { count: 'exact', head: true }).not('paid_at', 'is', null),
      supabase.from('direct_hires').select('*', { count: 'exact', head: true }).not('paid_at', 'is', null),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true })
    ])

    const bookingsTotal = (contractsCount.count || 0) + (directHiresCount.count || 0)
    const paymentsTotal = (paidContractsCount.count || 0) + (paidHiresCount.count || 0)

    const actionsData = [
      { name: "Jobs Created", value: jobPostsCount.count || 0 },
      { name: "Bookings Made", value: bookingsTotal },
      { name: "Payments Completed", value: paymentsTotal },
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
      const [posts, contracts, directHires, messages] = await Promise.all([
        supabase.from('forumposts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', date.toISOString())
          .lt('created_at', nextMonth.toISOString()),
        supabase.from('contracts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', date.toISOString())
          .lt('created_at', nextMonth.toISOString()),
        supabase.from('direct_hires')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', date.toISOString())
          .lt('created_at', nextMonth.toISOString()),
        supabase.from('messages')
          .select('*', { count: 'exact', head: true })
          .gte('sent_at', date.toISOString())
          .lt('sent_at', nextMonth.toISOString())
      ])
      
      const totalActivities = 
        (posts.count || 0) + 
        (contracts.count || 0) + 
        (directHires.count || 0) + 
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
      // Don't delete verification documents, they're audit records
      return { data: null, error: { message: 'Cannot delete verification documents' } as any }
    case 'contract':
      result = await supabase
        .from('contracts')
        .delete()
        .eq('contract_id', parseInt(entityId))
      break
    case 'hire':
      result = await supabase
        .from('direct_hires')
        .delete()
        .eq('hire_id', parseInt(entityId))
      break
    case 'profile':
      // Don't delete packages as they're worker profile data
      return { data: null, error: { message: 'Cannot delete profile updates' } as any }
    default:
      return { data: null, error: { message: 'Unknown activity type' } as any }
  }
  
  return result
}

