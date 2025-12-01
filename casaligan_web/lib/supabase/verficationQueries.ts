import { createClient } from './client'

/**
 * Verification-specific queries for admin dashboard
 */

// Get all verifications with worker and user information
export async function getVerifications(limit = 50, offset = 0, status?: string) {
  const supabase = createClient()
  
  // Build query with optional status filter
  let query = supabase
    .from('verifications')
    .select('verification_id, worker_id, admin_id, status, document_type, document_number, file_path, submitted_at, reviewed_at', { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply status filter if provided
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: verifications, error: verificationsError, count } = await query

  if (verificationsError) {
    console.error('Error fetching verifications:', verificationsError)
    return { data: [], count: 0, error: verificationsError }
  }

  if (!verifications || verifications.length === 0) {
    return { data: [], count: count || 0, error: null }
  }

  // Get worker IDs and fetch workers with user information
  const workerIds = verifications.map(v => v.worker_id).filter(Boolean)
  const { data: workers, error: workersError } = await supabase
    .from('workers')
    .select('worker_id, user_id')
    .in('worker_id', workerIds)

  if (workersError) {
    console.error('Error fetching workers:', workersError)
    return { data: verifications.map(v => ({ ...v, workers: null, users: null })), count: count || 0, error: null }
  }

  // Get user IDs and fetch users (including role)
  const userIds = workers?.map(w => w.user_id).filter(Boolean) || []
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('user_id, name, email, phone_number, status, role, created_at, profile_picture')
    .in('user_id', userIds)

  if (usersError) {
    console.error('Error fetching users:', usersError)
    return { data: verifications.map(v => ({ ...v, workers: null, users: null })), count: count || 0, error: null }
  }

  // Combine verifications with their worker and user data
  const verificationsWithDetails = verifications.map(verification => {
    const worker = workers?.find(w => w.worker_id === verification.worker_id) || null
    const user = users?.find(u => u.user_id === worker?.user_id) || null
    return { 
      ...verification, 
      workers: worker, 
      users: user 
    }
  })

  return { data: verificationsWithDetails, count: count || 0, error: null }
}

// Get verification by ID with full details
export async function getVerificationById(verificationId: number) {
  const supabase = createClient()
  
  const { data: verification, error: verificationError } = await supabase
    .from('verifications')
    .select('verification_id, worker_id, admin_id, status, document_type, document_number, file_path, submitted_at, reviewed_at')
    .eq('verification_id', verificationId)
    .single()

  if (verificationError) {
    console.error('Error fetching verification:', verificationError)
    return { data: null, error: verificationError }
  }

  if (!verification) {
    return { data: null, error: null }
  }

  // Get worker information
  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .select('worker_id, user_id')
    .eq('worker_id', verification.worker_id)
    .single()

  if (workerError) {
    console.error('Error fetching worker:', workerError)
    return { data: { ...verification, workers: null, users: null }, error: null }
  }

  // Get user information (including role)
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('user_id, name, email, phone_number, status, role, created_at, profile_picture')
    .eq('user_id', worker.user_id)
    .single()

  if (userError) {
    console.error('Error fetching user:', userError)
    return { data: { ...verification, workers: worker, users: null }, error: null }
  }

  return { 
    data: { 
      ...verification, 
      workers: worker, 
      users: user 
    }, 
    error: null 
  }
}

// Approve a verification (set status to accepted)
export async function approveVerification(verificationId: number, adminId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('verifications')
    .update({ 
      status: 'accepted',
      admin_id: adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq('verification_id', verificationId)
    .select()
  
  return { data, error }
}

// Reject a verification (set status to rejected)
export async function rejectVerification(verificationId: number, adminId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('verifications')
    .update({ 
      status: 'rejected',
      admin_id: adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq('verification_id', verificationId)
    .select()
  
  return { data, error }
}

// Get verification analytics data
export async function getVerificationAnalytics(startDate?: Date, endDate?: Date) {
  const supabase = createClient()
  
  // Get all verifications
  let query = supabase
    .from('verifications')
    .select('verification_id, status, submitted_at')

  // Apply date filter if provided
  if (startDate && endDate) {
    query = query
      .gte('submitted_at', startDate.toISOString())
      .lte('submitted_at', endDate.toISOString())
  }

  const { data: verifications, error: verificationsError } = await query

  if (verificationsError) {
    console.error('Error fetching verification analytics:', verificationsError)
    return {
      statusData: [],
      monthlyData: [],
      totalCount: 0,
      pendingCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      error: verificationsError
    }
  }

  // Calculate status statistics
  const acceptedCount = verifications?.filter(v => v.status === 'accepted').length || 0
  const rejectedCount = verifications?.filter(v => v.status === 'rejected').length || 0
  const pendingCount = verifications?.filter(v => v.status === 'pending').length || 0

  const statusData = [
    { name: "Accepted", value: acceptedCount },
    { name: "Rejected", value: rejectedCount },
    { name: "Pending", value: pendingCount },
  ]

  // Calculate monthly verification requests
  const now = new Date()
  let start: Date
  let end: Date

  if (startDate && endDate) {
    start = startDate
    end = endDate
  } else {
    // Default to last 4 months
    const fourMonthsAgo = new Date()
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)
    start = fourMonthsAgo
    end = now
  }

  // Filter verifications within date range
  const filteredVerifications = verifications?.filter(v => {
    const submittedAt = new Date(v.submitted_at)
    return submittedAt >= start && submittedAt <= end
  }) || []

  // Group by month
  const monthCounts: { [key: string]: number } = {}
  filteredVerifications.forEach(verification => {
    const date = new Date(verification.submitted_at)
    const monthKey = date.toLocaleString('en-US', { month: 'short' })
    monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1
  })

  const monthlyData = Object.entries(monthCounts).map(([month, value]) => ({
    month,
    value
  }))

  return {
    statusData,
    monthlyData,
    totalCount: verifications?.length || 0,
    pendingCount,
    acceptedCount,
    rejectedCount,
    error: null
  }
}

// Get verification statistics for dashboard
export async function getVerificationStats() {
  const supabase = createClient()
  
  // Get counts by status
  const { count: pendingCount } = await supabase
    .from('verifications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: acceptedCount } = await supabase
    .from('verifications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'accepted')

  const { count: rejectedCount } = await supabase
    .from('verifications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'rejected')

  const { count: totalCount } = await supabase
    .from('verifications')
    .select('*', { count: 'exact', head: true })

  return {
    pending: pendingCount || 0,
    accepted: acceptedCount || 0,
    rejected: rejectedCount || 0,
    total: totalCount || 0
  }
}

// Get verifications by worker ID
export async function getVerificationsByWorkerId(workerId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('verifications')
    .select('verification_id, worker_id, admin_id, status, document_type, document_number, file_path, submitted_at, reviewed_at')
    .eq('worker_id', workerId)
    .order('submitted_at', { ascending: false })

  if (error) {
    console.error('Error fetching worker verifications:', error)
    return { data: [], error }
  }

  return { data: data || [], error: null }
}

// Get user counts (Workers vs Employers) for analytics
export async function getUserCounts() {
  const supabase = createClient()
  
  // Get workers count
  const { count: workersCount, error: workersError } = await supabase
    .from('workers')
    .select('*', { count: 'exact', head: true })

  // Get employers count
  const { count: employersCount, error: employersError } = await supabase
    .from('employers')
    .select('*', { count: 'exact', head: true })

  if (workersError || employersError) {
    console.error('Error fetching user counts:', workersError || employersError)
    return {
      workers: 0,
      employers: 0,
      error: workersError || employersError
    }
  }

  return {
    workers: workersCount || 0,
    employers: employersCount || 0,
    error: null
  }
}

