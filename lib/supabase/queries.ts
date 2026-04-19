import { createClient } from './server'

/**
 * Common database queries for admin dashboard
 * Updated to match actual Supabase schema
 */

const WEEK_BUCKETS = 5
const MS_PER_DAY = 24 * 60 * 60 * 1000

const startOfWeek = (value: Date) => {
  const date = new Date(value)
  const day = date.getDay()
  const diff = (day + 6) % 7
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}

const getIsoWeek = (value: Date) => {
  const date = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7)
}

const buildWeekBuckets = (count: number) => {
  const weeks: { key: string; label: string; start: Date; end: Date }[] = []
  const currentWeekStart = startOfWeek(new Date())
  const firstWeekStart = new Date(currentWeekStart)
  firstWeekStart.setDate(firstWeekStart.getDate() - (count - 1) * 7)

  for (let i = 0; i < count; i += 1) {
    const start = new Date(firstWeekStart)
    start.setDate(firstWeekStart.getDate() + (i * 7))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    const weekNumber = getIsoWeek(start)
    const key = `${start.getFullYear()}-W${weekNumber}`
    const label = `W${weekNumber}`
    weeks.push({ key, label, start, end })
  }

  return weeks
}

const getWeekKey = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const start = startOfWeek(date)
  return `${start.getFullYear()}-W${getIsoWeek(start)}`
}

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const percentChange = (current: number, previous: number) => {
  if (previous <= 0) {
    return current > 0 ? 100 : 0
  }
  return ((current - previous) / previous) * 100
}

const isMissingColumnError = (error: any, column: string) => {
  return error?.code === '42703' && String(error?.message || '').includes(column)
}

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

  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - 30)
  const previousStart = new Date(now)
  previousStart.setDate(previousStart.getDate() - 60)

  const [currentUsers, previousUsers, currentJobs, previousJobs, currentContracts, previousContracts, currentDirectHires, previousDirectHires] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', currentStart.toISOString()),
    supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', previousStart.toISOString()).lt('created_at', currentStart.toISOString()),
    supabase.from('forumposts').select('*', { count: 'exact', head: true }).gte('created_at', currentStart.toISOString()),
    supabase.from('forumposts').select('*', { count: 'exact', head: true }).gte('created_at', previousStart.toISOString()).lt('created_at', currentStart.toISOString()),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).gte('created_at', currentStart.toISOString()),
    supabase.from('contracts').select('*', { count: 'exact', head: true }).gte('created_at', previousStart.toISOString()).lt('created_at', currentStart.toISOString()),
    supabase.from('direct_hires').select('*', { count: 'exact', head: true }).gte('created_at', currentStart.toISOString()),
    supabase.from('direct_hires').select('*', { count: 'exact', head: true }).gte('created_at', previousStart.toISOString()).lt('created_at', currentStart.toISOString()),
  ])

  const currentBookings = (currentContracts.count || 0) + (currentDirectHires.count || 0)
  const previousBookings = (previousContracts.count || 0) + (previousDirectHires.count || 0)

  return {
    totalUsers: usersResult.count || 0,
    totalJobs: jobsResult.count || 0,
    totalBookings: totalBookings,
    trends: {
      users: percentChange(currentUsers.count || 0, previousUsers.count || 0),
      jobs: percentChange(currentJobs.count || 0, previousJobs.count || 0),
      bookings: percentChange(currentBookings, previousBookings),
    },
  }
}

export async function getDashboardAnalytics() {
  const supabase = await createClient()
  const weekBuckets = buildWeekBuckets(WEEK_BUCKETS)
  const rangeStart = weekBuckets[0]?.start?.toISOString() ?? new Date().toISOString()

  const [contractsResult, directHiresResult, directHireFeesResult, paymentTransactionsResult, statusResult, workersResult, employersResult] = await Promise.all([
    supabase.from('contracts').select('created_at').gte('created_at', rangeStart),
    supabase.from('direct_hires').select('created_at, paid_at, platform_fee_amount, platform_fee_status').gte('created_at', rangeStart),
    supabase
      .from('direct_hires')
      .select('paid_at, created_at, platform_fee_amount, platform_fee_status, payment_method')
      .gte('created_at', rangeStart),
    supabase
      .from('payment_transactions')
      .select('paid_at, amount_paid, payment_method')
      .gte('paid_at', rangeStart),
    supabase.from('forumposts').select('status'),
    supabase.from('workers').select('*', { count: 'exact', head: true }),
    supabase.from('employers').select('*', { count: 'exact', head: true }),
  ])

  const bookingsByWeek: Record<string, number> = {}
  const revenueByCategory: Record<string, number> = {}
  weekBuckets.forEach((bucket) => {
    bookingsByWeek[bucket.key] = 0
  })

  ;(contractsResult.data || []).forEach((contract: { created_at?: string }) => {
    const key = getWeekKey(contract.created_at)
    if (key && key in bookingsByWeek) {
      bookingsByWeek[key] += 1
    }
  })

  ;(directHiresResult.data || []).forEach((hire: { created_at?: string }) => {
    const key = getWeekKey(hire.created_at)
    if (key && key in bookingsByWeek) {
      bookingsByWeek[key] += 1
    }
  })

  const addRevenueByCategory = (method: unknown, amount: number) => {
    const raw = String(method || '').trim()
    const key = !raw || raw.toLowerCase() === 'unknown' ? 'Others' : raw
    revenueByCategory[key] = (revenueByCategory[key] || 0) + amount
  }

  ;(paymentTransactionsResult.data || []).forEach((payment: any) => {
    addRevenueByCategory(payment.payment_method, toNumber(payment.amount_paid))
  })

  ;(directHireFeesResult.data || []).forEach((hire: any) => {
    const status = String(hire.platform_fee_status || '').toLowerCase()
    if (status === 'paid') {
      addRevenueByCategory(hire.payment_method, toNumber(hire.platform_fee_amount))
    }
  })

  const bookingsSeries = weekBuckets.map((bucket) => ({
    week: bucket.label,
    bookings: bookingsByWeek[bucket.key] ?? 0,
  }))

  const revenueSeries = Object.entries(revenueByCategory)
    .map(([category, total]) => ({
      category,
      revenue: Number(total.toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const workerCount = workersResult.count || 0
  const employerCount = employersResult.count || 0
  const totalUserCount = workerCount + employerCount
  const workerPercent = totalUserCount > 0 ? Number(((workerCount / totalUserCount) * 100).toFixed(1)) : 0
  const employerPercent = totalUserCount > 0 ? Number(((employerCount / totalUserCount) * 100).toFixed(1)) : 0

  const userDistribution = [
    { label: 'Workers', value: workerPercent, color: '#e7467b' },
    { label: 'Employers', value: employerPercent, color: '#173d6c' },
  ]

  const statusCounts: Record<string, number> = {
    open: 0,
    in_queue: 0,
    ongoing: 0,
    pending_completion: 0,
    completed: 0,
  }

  ;(statusResult.data || []).forEach((row: { status?: string }) => {
    const status = String(row.status || '').toLowerCase()
    if (status in statusCounts) {
      statusCounts[status] += 1
    }
  })

  const jobStatusMix = [
    { label: 'Open', value: statusCounts.open },
    { label: 'In Queue', value: statusCounts.in_queue },
    { label: 'Ongoing', value: statusCounts.ongoing },
    { label: 'Pending', value: statusCounts.pending_completion },
    { label: 'Completed', value: statusCounts.completed },
  ]

  const topStatus = jobStatusMix.reduce((top, item) => (item.value > top.value ? item : top), jobStatusMix[0])
  const totalJobs = jobStatusMix.reduce((sum, item) => sum + item.value, 0)

  const rangeLabel = weekBuckets.length > 0
    ? `${weekBuckets[0].start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekBuckets[weekBuckets.length - 1].end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : ''

  const error = contractsResult.error || directHiresResult.error || directHireFeesResult.error || paymentTransactionsResult.error || statusResult.error || workersResult.error || employersResult.error || null

  if (error) {
    console.error('Error loading dashboard analytics:', error)
  }

  return {
    data: {
      bookingsByWeek: bookingsSeries,
      revenueByWeek: revenueSeries,
      userDistribution,
      jobStatusMix,
      jobStatusSummary: {
        topLabel: topStatus?.label || 'N/A',
        total: totalJobs,
      },
      rangeLabel,
    },
    error,
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
  const { data: schedules, error: _schedulesError } = await supabase
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
  
  type Activity = { type: string; title: string; description: string; date: string; user_name: string }
  const activities: Activity[] = []

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

  type PostType = { post_id?: number; title?: string; created_at?: string; employers?: { user_id?: number; users?: { id?: number; first_name?: string; last_name?: string } | { id?: number; first_name?: string; last_name?: string }[] } | { user_id?: number; users?: { id?: number; first_name?: string; last_name?: string } | { id?: number; first_name?: string; last_name?: string }[] }[] }
  jobPosts?.forEach((post: PostType) => {
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

  type ContractType = { created_at?: string; workers?: { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] } | { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }[]; employers?: { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] } | { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }[] }
  contracts?.forEach((contract: ContractType) => {
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

  directHires?.forEach((hire: { workers?: { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] } | { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }[]; employers?: { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] } | { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[] }[]; created_at?: string }) => {
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

  messages?.forEach((message: { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[]; sent_at?: string }) => {
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

  verifications?.forEach((doc: { users?: { first_name?: string; last_name?: string } | { first_name?: string; last_name?: string }[]; reviewed_at?: string }) => {
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

