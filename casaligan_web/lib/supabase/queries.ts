import { createClient } from './server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Common database queries for admin dashboard
 * Updated to match actual Supabase schema
 */

// Get dashboard statistics
export async function getDashboardStats() {
  const supabase = await createClient()
  
  const [usersResult, jobsResult, contractsResult, directHiresResult] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('forumposts').select('*', { count: 'exact', head: true }),
    supabase.from('contracts').select('*', { count: 'exact', head: true }),
    supabase.from('direct_hires').select('*', { count: 'exact', head: true }),
  ])

  const totalBookings = (contractsResult.count || 0) + (directHiresResult.count || 0)

  return {
    totalUsers: usersResult.count || 0,
    totalJobs: jobsResult.count || 0,
    totalBookings: totalBookings,
  }
}

// Get all workers with user information joined
export async function getWorkers(limit = 50, offset = 0) {
  const supabase = await createClient()
  
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

// Get all employers with user information joined
export async function getEmployers(limit = 50, offset = 0) {
  const supabase = await createClient()
  
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

// Get all bookings with related information
export async function getBookings(limit = 50, offset = 0) {
  const supabase = await createClient()
  
  // Get total count and bookings
  const { data: bookings, error: bookingsError, count } = await supabase
    .from('bookings')
    .select('booking_id, schedule_id, status, booking_date, notes', { count: 'exact' })
    .order('booking_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (bookingsError) {
    console.error('Error fetching bookings:', bookingsError)
    return { data: [], count: 0, error: bookingsError }
  }

  if (!bookings || bookings.length === 0) {
    return { data: [], count: count || 0, error: null }
  }

  // Get schedule IDs and fetch schedules
  const scheduleIds = bookings.map(b => b.schedule_id).filter(Boolean)
  const { data: schedules, error: schedulesError } = await supabase
    .from('schedules')
    .select('schedule_id, package_id, employer_id, available_date, start_time, end_time, status')
    .in('schedule_id', scheduleIds)

  // Combine bookings with their schedule data
  const bookingsWithSchedules = bookings.map(booking => {
    const schedule = schedules?.find(s => s.schedule_id === booking.schedule_id) || null
    return { ...booking, schedules: schedule }
  })

  return { data: bookingsWithSchedules, count: count || 0, error: null }
}

// Get recent activities from various sources
export async function getRecentActivities(limit = 20) {
  const supabase = await createClient()
  
  const activities: any[] = []

  // Get recent job posts
  const { data: jobPosts } = await supabase
    .from('forumposts')
    .select(`
      post_id,
      title,
      created_at,
      employers:employer_id (
        user_id,
        users:user_id (
          id,
          first_name,
          last_name
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  jobPosts?.forEach((post: any) => {
    const employer = Array.isArray(post.employers) ? post.employers[0] : post.employers
    const user = Array.isArray(employer?.users) ? employer.users[0] : employer?.users
    if (user) {
      activities.push({
        type: 'job_post',
        title: 'New Job Posted',
        description: `${user.first_name} ${user.last_name} posted: ${post.title}`,
        date: post.created_at,
        user_name: `${user.first_name} ${user.last_name}`
      })
    }
  })

  // Get recent contracts
  const { data: contracts } = await supabase
    .from('contracts')
    .select(`
      contract_id,
      status,
      created_at,
      workers:worker_id (
        user_id,
        users:user_id (
          id,
          first_name,
          last_name
        )
      ),
      employers:employer_id (
        user_id,
        users:user_id (
          id,
          first_name,
          last_name
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  contracts?.forEach((contract: any) => {
    const worker = Array.isArray(contract.workers) ? contract.workers[0] : contract.workers
    const employer = Array.isArray(contract.employers) ? contract.employers[0] : contract.employers
    const workerUser = Array.isArray(worker?.users) ? worker.users[0] : worker?.users
    const employerUser = Array.isArray(employer?.users) ? employer.users[0] : employer?.users
    
    if (workerUser && employerUser) {
      activities.push({
        type: 'contract',
        title: 'New Contract',
        description: `${employerUser.first_name} ${employerUser.last_name} hired ${workerUser.first_name} ${workerUser.last_name}`,
        date: contract.created_at,
        user_name: `${employerUser.first_name} ${employerUser.last_name}`
      })
    }
  })

  // Get recent direct hires
  const { data: directHires } = await supabase
    .from('direct_hires')
    .select(`
      hire_id,
      status,
      created_at,
      workers:worker_id (
        user_id,
        users:user_id (
          id,
          first_name,
          last_name
        )
      ),
      employers:employer_id (
        user_id,
        users:user_id (
          id,
          first_name,
          last_name
        )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  directHires?.forEach((hire: any) => {
    const worker = Array.isArray(hire.workers) ? hire.workers[0] : hire.workers
    const employer = Array.isArray(hire.employers) ? hire.employers[0] : hire.employers
    const workerUser = Array.isArray(worker?.users) ? worker.users[0] : worker?.users
    const employerUser = Array.isArray(employer?.users) ? employer.users[0] : employer?.users
    
    if (workerUser && employerUser) {
      activities.push({
        type: 'direct_hire',
        title: 'New Booking',
        description: `${employerUser.first_name} ${employerUser.last_name} booked ${workerUser.first_name} ${workerUser.last_name}`,
        date: hire.created_at,
        user_name: `${employerUser.first_name} ${employerUser.last_name}`
      })
    }
  })

  // Get recent messages
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      message_id,
      sent_at,
      users:sender_id (
        id,
        first_name,
        last_name
      )
    `)
    .order('sent_at', { ascending: false })
    .limit(limit)

  messages?.forEach((message: any) => {
    const user = Array.isArray(message.users) ? message.users[0] : message.users
    if (user) {
      activities.push({
        type: 'message',
        title: 'New Message',
        description: `${user.first_name} ${user.last_name} sent a message`,
        date: message.sent_at,
        user_name: `${user.first_name} ${user.last_name}`
      })
    }
  })

  // Get recent verifications from user_documents
  const { data: verifications } = await supabase
    .from('user_documents')
    .select(`
      document_id,
      status,
      reviewed_at,
      users:user_id (
        id,
        first_name,
        last_name
      )
    `)
    .eq('status', 'approved')
    .not('reviewed_at', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(limit)

  verifications?.forEach((doc: any) => {
    const user = Array.isArray(doc.users) ? doc.users[0] : doc.users
    if (user) {
      activities.push({
        type: 'verification',
        title: 'Account Verified',
        description: `${user.first_name} ${user.last_name}'s document was approved`,
        date: doc.reviewed_at,
        user_name: `${user.first_name} ${user.last_name}`
      })
    }
  })

  // Sort all activities by date and limit
  const sorted = activities
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)

  return { data: sorted, error: null }
}

// Get authenticated user
export async function getCurrentUser() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  return { user, error }
}

// Sign out the current user
export async function signOut() {
  const supabase = await createClient()
  
  const { error } = await supabase.auth.signOut()
  
  return { error }
}

// Ban a user (set status to suspended and soft delete)
export async function banUser(userId: number) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('users')
    .update({ 
      status: 'suspended',
      deleted_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Restrict a user (set status to inactive)
export async function restrictUser(userId: number) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('users')
    .update({ 
      status: 'inactive'
    })
    .eq('user_id', userId)
    .select()
  
  return { data, error }
}

// Unrestrict/Unban a user (set status back to active)
export async function activateUser(userId: number) {
  const supabase = await createClient()
  
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

