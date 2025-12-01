import { createClient } from './server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Common database queries for admin dashboard
 * Updated to match actual Supabase schema
 */

// Get dashboard statistics
export async function getDashboardStats() {
  const supabase = await createClient()
  
  const [usersResult, packagesResult, bookingsResult] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('packages').select('*', { count: 'exact', head: true }),
    supabase.from('bookings').select('*', { count: 'exact', head: true }),
  ])

  return {
    totalUsers: usersResult.count || 0,
    totalJobs: packagesResult.count || 0, // packages are like "jobs"
    totalBookings: bookingsResult.count || 0,
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

// Get recent activities from verification logs and notifications
export async function getRecentActivities(limit = 20) {
  const supabase = await createClient()
  
  // Get verification logs
  const { data: verificationLogs, error: vError } = await supabase
    .from('verification_logs')
    .select('*')
    .order('changed_at', { ascending: false })
    .limit(limit)

  // Get recent notifications
  const { data: notifications, error: nError } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (vError || nError) {
    console.error('Error fetching activities:', vError || nError)
    return { data: [], error: vError || nError }
  }

  // Combine and sort by date
  const combined = [
    ...(verificationLogs?.map(log => ({ ...log, type: 'verification', date: log.changed_at })) || []),
    ...(notifications?.map(notif => ({ ...notif, type: 'notification', date: notif.created_at })) || [])
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit)

  return { data: combined, error: null }
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

