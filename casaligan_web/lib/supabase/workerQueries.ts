import { createClient } from './client'

/**
 * Worker-specific queries for admin dashboard
 */

// Get all workers with user information
export async function getWorkers(limit = 50, offset = 0) {
  const supabase = createClient()
  
  // Get total count and workers
  const { data: workers, error: workersError, count } = await supabase
    .from('workers')
    .select('worker_id, user_id, years_experience, bio, religion_id', { count: 'exact' })
    .order('worker_id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (workersError) {
    console.error('Error fetching workers:', workersError)
    return { data: [], count: 0, error: workersError }
  }

  if (!workers || workers.length === 0) {
    return { data: [], count: count || 0, error: null }
  }

  // Get user IDs and fetch users
  const userIds = workers.map(w => w.user_id).filter(Boolean)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('user_id, name, email, phone_number, status, created_at, profile_picture')
    .in('user_id', userIds)

  if (usersError) {
    console.error('Error fetching users:', usersError)
    // Return workers without user data
    return { data: workers.map(w => ({ ...w, users: null })), count: count || 0, error: null }
  }

  // Combine workers with their user data
  const workersWithUsers = workers.map(worker => {
    const user = users?.find(u => u.user_id === worker.user_id) || null
    return { ...worker, users: user }
  })

  return { data: workersWithUsers, count: count || 0, error: null }
}

// Get worker skills
export async function getWorkerSkills(workerId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('worker_skills')
    .select(`
      skill_id,
      skills (
        skill_id,
        name
      )
    `)
    .eq('worker_id', workerId)

  if (error) {
    console.error('Error fetching worker skills:', error)
    return { data: [], error }
  }

  return { data: data?.map(ws => ws.skills).filter(Boolean) || [], error: null }
}

// Get worker certifications
export async function getWorkerCertifications(workerId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('worker_certifications')
    .select(`
      certification_id,
      certifications (
        certification_id,
        name
      )
    `)
    .eq('worker_id', workerId)

  if (error) {
    console.error('Error fetching worker certifications:', error)
    return { data: [], error }
  }

  return { data: data?.map(wc => wc.certifications).filter(Boolean) || [], error: null }
}

// Get worker languages
export async function getWorkerLanguages(workerId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('worker_languages')
    .select(`
      language_id,
      languages (
        language_id,
        name
      )
    `)
    .eq('worker_id', workerId)

  if (error) {
    console.error('Error fetching worker languages:', error)
    return { data: [], error }
  }

  return { data: data?.map(wl => wl.languages).filter(Boolean) || [], error: null }
}

// Ban a worker (set status to banned and soft delete)
export async function banWorker(userId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('users')
    .update({ 
      status: 'banned',
      deleted_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Unban a worker (set status to active and clear deleted_at)
export async function unbanWorker(userId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('users')
    .update({ 
      status: 'active',
      deleted_at: null
    })
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Restrict a worker (set status to restricted)
// Requires: Run the migration script add-restriction-reason-to-users.sql to add the restriction_reason field
export async function restrictWorker(userId: number, reason?: string) {
  const supabase = createClient()
  
  // Get the current admin's ID from the database
  const { getAdminId } = await import('./adminQueries');
  const { admin_id, error: adminError } = await getAdminId();
  
  if (adminError || !admin_id) {
    return { data: null, error: adminError || new Error("Admin not authenticated") };
  }

  const updateData: any = { 
    status: 'restricted',
    restricted_at: new Date().toISOString(),
    restricted_by_admin_id: admin_id
  };

  // Add restriction reason if provided
  if (reason) {
    updateData.restriction_reason = reason;
  }
  
  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Unrestrict a worker (set status to active and clear restriction data)
export async function unrestrictWorker(userId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('users')
    .update({ 
      status: 'active',
      restriction_reason: null,
      restricted_at: null,
      restricted_by_admin_id: null
    })
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Activate a worker (general function to set status to active)
export async function activateWorker(userId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('users')
    .update({ 
      status: 'active',
      deleted_at: null
    })
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Get worker analytics data
export async function getWorkerAnalytics(newAccountsStartDate?: Date, newAccountsEndDate?: Date) {
  const supabase = createClient()
  
  // Get all workers with their user status
  const { data: workers, error: workersError } = await supabase
    .from('workers')
    .select('worker_id, user_id, users(user_id, status, created_at)')
  
  if (workersError) {
    console.error('Error fetching worker analytics:', workersError)
    return { 
      activityData: [],
      restrictedData: [],
      topWorkers: [],
      newAccountsData: [],
      error: workersError 
    }
  }

  // Calculate activity statistics (Active vs Inactive)
  // Note: banned and restricted users are counted as inactive
  const activeCount = workers?.filter((w: any) => w.users?.status === 'active').length || 0
  const inactiveCount = workers?.filter((w: any) => 
    w.users?.status === 'inactive' || w.users?.status === 'banned' || w.users?.status === 'restricted'
  ).length || 0
  
  const activityData = [
    { name: "Active", value: activeCount },
    { name: "Inactive", value: inactiveCount },
  ]

  // Calculate restricted/banned statistics
  const restrictedCount = workers?.filter((w: any) => w.users?.status === 'restricted').length || 0
  const bannedCount = workers?.filter((w: any) => w.users?.status === 'banned').length || 0
  
  const restrictedData = [
    { name: "Restricted", value: restrictedCount },
    { name: "Banned", value: bannedCount },
  ]

  // Get top workers (based on job applications/interest checks)
  const { data: allWorkersWithInterests } = await supabase
    .from('workers')
    .select('worker_id, user_id, users(name), interestcheck(interest_id)')
  
  // Sort by number of applications and get top 2
  const sortedWorkers = allWorkersWithInterests
    ?.map((worker: any) => ({
      worker_id: worker.worker_id,
      user_id: worker.user_id,
      name: worker.users?.name || 'N/A',
      applicationCount: worker.interestcheck?.length || 0
    }))
    .sort((a: any, b: any) => b.applicationCount - a.applicationCount)
    .slice(0, 2) || []

  const topWorkers = sortedWorkers.map((worker: any, index: number) => ({
    name: worker.name,
    jobs: `${worker.applicationCount} Jobs Applied`,
    rank: index + 1
  }))

  // Get new accounts in specified date range or last 4 months
  let startDate: Date
  let endDate: Date
  
  if (newAccountsStartDate && newAccountsEndDate) {
    startDate = newAccountsStartDate
    endDate = newAccountsEndDate
  } else {
    const fourMonthsAgo = new Date()
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4)
    startDate = fourMonthsAgo
    endDate = new Date()
  }
  
  const { data: newAccounts, error: newAccountsError } = await supabase
    .from('workers')
    .select('worker_id, user_id, users(created_at)')
    .gte('users.created_at', startDate.toISOString())
    .lte('users.created_at', endDate.toISOString())

  // Group by month
  const monthCounts: { [key: string]: number } = {}
  newAccounts?.forEach((worker: any) => {
    if (worker.users?.created_at) {
      const date = new Date(worker.users.created_at)
      const monthKey = date.toLocaleString('en-US', { month: 'short' })
      monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1
    }
  })

  const newAccountsData = Object.entries(monthCounts).map(([month, value]) => ({
    month,
    value
  }))

  return {
    activityData,
    restrictedData,
    topWorkers,
    newAccountsData,
    error: null
  }
}

// Get worker activity statistics
export async function getWorkerActivityStats(startDate?: Date, endDate?: Date) {
  const supabase = createClient()
  
  const now = new Date()
  let thisMonthStart: Date
  let thisMonthEnd: Date
  let lastMonthStart: Date
  let lastMonthEnd: Date

  if (startDate && endDate) {
    // Use provided date range
    thisMonthStart = startDate
    thisMonthEnd = endDate
    
    // Calculate previous period of same length
    const periodLength = endDate.getTime() - startDate.getTime()
    lastMonthEnd = new Date(startDate.getTime() - 1)
    lastMonthStart = new Date(lastMonthEnd.getTime() - periodLength)
  } else {
    // Default to current month vs last month
    thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    thisMonthEnd = now
    lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
  }

  // Get job applications (interest checks) count
  const { count: thisMonthApplications } = await supabase
    .from('interestcheck')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString())
  
  const { count: lastMonthApplications } = await supabase
    .from('interestcheck')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString())

  // Get packages created count
  const { count: thisMonthPackages } = await supabase
    .from('packages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString())
  
  const { count: lastMonthPackages } = await supabase
    .from('packages')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString())

  // Get bookings received count (from contracts and direct_hires tables used by mobile app)
  const { count: thisMonthContracts } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString())
  
  const { count: thisMonthDirectHires } = await supabase
    .from('direct_hires')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString())
  
  const { count: lastMonthContracts } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString())
  
  const { count: lastMonthDirectHires } = await supabase
    .from('direct_hires')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString())
  
  const thisMonthBookings = (thisMonthContracts || 0) + (thisMonthDirectHires || 0)
  const lastMonthBookings = (lastMonthContracts || 0) + (lastMonthDirectHires || 0)

  // Get messages sent by workers (proper join with workers table)
  // First get all worker user_ids
  const { data: workerUsers } = await supabase
    .from('workers')
    .select('user_id')
  
  const workerUserIds = workerUsers?.map(w => w.user_id) || []
  
  const { count: thisMonthMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('sender_id', workerUserIds)
    .gte('sent_at', thisMonthStart.toISOString())
    .lte('sent_at', thisMonthEnd.toISOString())
  
  const { count: lastMonthMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('sender_id', workerUserIds)
    .gte('sent_at', lastMonthStart.toISOString())
    .lte('sent_at', lastMonthEnd.toISOString())

  return [
    { activity: "Applied to Jobs", thisMonth: thisMonthApplications || 0, lastMonth: lastMonthApplications || 0 },
    { activity: "Created Packages", thisMonth: thisMonthPackages || 0, lastMonth: lastMonthPackages || 0 },
    { activity: "Received Bookings", thisMonth: thisMonthBookings || 0, lastMonth: lastMonthBookings || 0 },
    { activity: "Messages Sent", thisMonth: thisMonthMessages || 0, lastMonth: lastMonthMessages || 0 },
  ]
}
