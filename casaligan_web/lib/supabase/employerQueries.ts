import { createClient } from './client'

/**
 * Employer-specific queries for admin dashboard
 */

// Get all employers with user information
export async function getEmployers(limit = 50, offset = 0) {
  const supabase = createClient()
  
  // Get total count and employers
  const { data: employers, error: employersError, count } = await supabase
    .from('employers')
    .select('employer_id, user_id, household_size, number_of_children, residence_type, preferences, bio, religion_id', { count: 'exact' })
    .order('employer_id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (employersError) {
    console.error('Error fetching employers:', employersError)
    return { data: [], count: 0, error: employersError }
  }

  if (!employers || employers.length === 0) {
    return { data: [], count: count || 0, error: null }
  }

  // Get user IDs and fetch users
  const userIds = employers.map(e => e.user_id).filter(Boolean)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('user_id, name, email, phone_number, status, created_at, profile_picture')
    .in('user_id', userIds)

  if (usersError) {
    console.error('Error fetching users:', usersError)
    // Return employers without user data
    return { data: employers.map(e => ({ ...e, users: null })), count: count || 0, error: null }
  }

  // Combine employers with their user data
  const employersWithUsers = employers.map(employer => {
    const user = users?.find(u => u.user_id === employer.user_id) || null
    return { ...employer, users: user }
  })

  return { data: employersWithUsers, count: count || 0, error: null }
}

// Ban an employer (set status to banned and soft delete)
export async function banEmployer(userId: number) {
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

// Unban an employer (set status to active and clear deleted_at)
export async function unbanEmployer(userId: number) {
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

// Restrict an employer (set status to restricted)
// Requires: Run the migration script add-restriction-reason-to-users.sql to add the restriction_reason field
export async function restrictEmployer(userId: number, reason?: string) {
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

// Unrestrict an employer (set status to active and clear restriction data)
export async function unrestrictEmployer(userId: number) {
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

// Activate an employer (general function to set status to active)
export async function activateEmployer(userId: number) {
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

// Get employer analytics data
export async function getEmployerAnalytics(newAccountsStartDate?: Date, newAccountsEndDate?: Date) {
  const supabase = createClient()
  
  // Get all employers with their user status
  const { data: employers, error: employersError } = await supabase
    .from('employers')
    .select('employer_id, user_id, users(user_id, status, created_at)')
  
  if (employersError) {
    console.error('Error fetching employer analytics:', employersError)
    return { 
      activityData: [],
      restrictedData: [],
      topEmployers: [],
      newAccountsData: [],
      error: employersError 
    }
  }

  // Calculate activity statistics (Active vs Inactive)
  // Note: banned and restricted users are counted as inactive
  const activeCount = employers?.filter((e: any) => e.users?.status === 'active').length || 0
  const inactiveCount = employers?.filter((e: any) => 
    e.users?.status === 'inactive' || e.users?.status === 'banned' || e.users?.status === 'restricted'
  ).length || 0
  
  const activityData = [
    { name: "Active", value: activeCount },
    { name: "Inactive", value: inactiveCount },
  ]

  // Calculate restricted/banned statistics
  const restrictedCount = employers?.filter((e: any) => e.users?.status === 'restricted').length || 0
  const bannedCount = employers?.filter((e: any) => e.users?.status === 'banned').length || 0
  
  const restrictedData = [
    { name: "Restricted", value: restrictedCount },
    { name: "Banned", value: bannedCount },
  ]

  // Get top employers (based on forum posts)
  const { data: allEmployersWithPosts } = await supabase
    .from('employers')
    .select('employer_id, user_id, users(name), forumposts(post_id)')
  
  // Sort by number of posts and get top 2
  const sortedEmployers = allEmployersWithPosts
    ?.map((emp: any) => ({
      employer_id: emp.employer_id,
      user_id: emp.user_id,
      name: emp.users?.name || 'N/A',
      postCount: emp.forumposts?.length || 0
    }))
    .sort((a: any, b: any) => b.postCount - a.postCount)
    .slice(0, 2) || []

  const topEmployers = sortedEmployers.map((emp: any, index: number) => ({
    name: emp.name,
    jobs: `${emp.postCount} Jobs Posted`,
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
    .from('employers')
    .select('employer_id, user_id, users(created_at)')
    .gte('users.created_at', startDate.toISOString())
    .lte('users.created_at', endDate.toISOString())

  // Group by month
  const monthCounts: { [key: string]: number } = {}
  newAccounts?.forEach((emp: any) => {
    if (emp.users?.created_at) {
      const date = new Date(emp.users.created_at)
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
    topEmployers,
    newAccountsData,
    error: null
  }
}

// Get employer activity statistics
export async function getEmployerActivityStats(startDate?: Date, endDate?: Date) {
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

  // Get forum posts count (job postings by employers)
  const { count: thisMonthJobs } = await supabase
    .from('forumposts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thisMonthStart.toISOString())
    .lte('created_at', thisMonthEnd.toISOString())
  
  const { count: lastMonthJobs } = await supabase
    .from('forumposts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', lastMonthStart.toISOString())
    .lte('created_at', lastMonthEnd.toISOString())

  // Get bookings count
  const { count: thisMonthBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .gte('booking_date', thisMonthStart.toISOString())
    .lte('booking_date', thisMonthEnd.toISOString())
  
  const { count: lastMonthBookings } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .gte('booking_date', lastMonthStart.toISOString())
    .lte('booking_date', lastMonthEnd.toISOString())

  // Get payments count
  const { count: thisMonthPayments } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .gte('payment_date', thisMonthStart.toISOString())
    .lte('payment_date', thisMonthEnd.toISOString())
  
  const { count: lastMonthPayments } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .gte('payment_date', lastMonthStart.toISOString())
    .lte('payment_date', lastMonthEnd.toISOString())

  // Get messages count
  const { count: thisMonthMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', thisMonthStart.toISOString())
    .lte('sent_at', thisMonthEnd.toISOString())
  
  const { count: lastMonthMessages } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .gte('sent_at', lastMonthStart.toISOString())
    .lte('sent_at', lastMonthEnd.toISOString())

  return [
    { activity: "Posted Jobs", thisMonth: thisMonthJobs || 0, lastMonth: lastMonthJobs || 0 },
    { activity: "Made Bookings", thisMonth: thisMonthBookings || 0, lastMonth: lastMonthBookings || 0 },
    { activity: "Made Payments", thisMonth: thisMonthPayments || 0, lastMonth: lastMonthPayments || 0 },
    { activity: "Messages Sent", thisMonth: thisMonthMessages || 0, lastMonth: lastMonthMessages || 0 },
  ]
}
