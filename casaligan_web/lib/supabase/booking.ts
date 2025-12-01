import { createClient } from './client'

/**
 * Booking-specific queries for admin dashboard
 * 
 * NOTE: Mobile app uses contracts and direct_hires tables instead of bookings
 * This maps mobile app data to the admin dashboard format
 */

// Get all bookings with related information (uses contracts and direct_hires from mobile app)
export async function getBookings(limit = 50, offset = 0, status?: string) {
  const supabase = createClient()
  
  // Get contracts (job bookings)
  let contractQuery = supabase
    .from('contracts')
    .select('contract_id, post_id, worker_id, employer_id, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') {
    // Map admin status to contract status
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'confirmed': 'active',
      'completed': 'completed',
      'cancelled': 'cancelled'
    }
    const mappedStatus = statusMap[status] || status
    contractQuery = contractQuery.eq('status', mappedStatus)
  }

  const { data: contracts, error: contractsError, count: contractCount } = await contractQuery

  if (contractsError) {
    console.error('Error fetching contracts:', contractsError)
    return { data: [], count: 0, error: contractsError }
  }

  // Get direct hires
  let directHireQuery = supabase
    .from('direct_hires')
    .select('hire_id, employer_id, worker_id, status, scheduled_date, total_amount, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') {
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'confirmed': 'accepted',
      'completed': 'paid',
      'cancelled': 'cancelled'
    }
    const mappedStatus = statusMap[status] || status
    directHireQuery = directHireQuery.eq('status', mappedStatus)
  }

  const { data: directHires, error: directHiresError, count: directHireCount } = await directHireQuery

  if (directHiresError) {
    console.error('Error fetching direct hires:', directHiresError)
  }

  const bookings = contracts || []
  const totalCount = (contractCount || 0) + (directHireCount || 0)

  if (bookings.length === 0 && (!directHires || directHires.length === 0)) {
    return { data: [], count: totalCount, error: null }
  }

  // Get job post IDs and fetch job posts
  const postIds = bookings.map(b => b.post_id).filter(Boolean)
  const { data: posts, error: postsError } = await supabase
    .from('forumposts')
    .select('post_id, title, salary, location, job_type, start_date, end_date')
    .in('post_id', postIds)

  if (postsError) {
    console.error('Error fetching posts:', postsError)
  }

  // Get worker IDs and fetch workers
  const workerIds = [...bookings.map(b => b.worker_id), ...(directHires?.map(h => h.worker_id) || [])].filter(Boolean)
  const { data: workers, error: workersError } = await supabase
    .from('workers')
    .select('worker_id, user_id')
    .in('worker_id', workerIds)

  if (workersError) {
    console.error('Error fetching workers:', workersError)
  }

  // Get employer IDs and fetch employers
  const employerIds = [...bookings.map(b => b.employer_id), ...(directHires?.map(h => h.employer_id) || [])].filter(Boolean)
  const { data: employers, error: employersError } = await supabase
    .from('employers')
    .select('employer_id, user_id')
    .in('employer_id', employerIds)

  if (employersError) {
    console.error('Error fetching employers:', employersError)
  }

  // Get all user IDs (workers and employers)
  const workerUserIds = workers?.map(w => w.user_id).filter(Boolean) || []
  const employerUserIds = employers?.map(e => e.user_id).filter(Boolean) || []
  const allUserIds = [...new Set([...workerUserIds, ...employerUserIds])]

  // Fetch all users
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, phone_number')
    .in('id', allUserIds)

  if (usersError) {
    console.error('Error fetching users:', usersError)
  }

  // Combine contract data
  const contractBookings = bookings.map(contract => {
    const post = posts?.find(p => p.post_id === contract.post_id) || null
    const worker = workers?.find(w => w.worker_id === contract.worker_id) || null
    const employer = employers?.find(e => e.employer_id === contract.employer_id) || null
    const workerUser = users?.find(u => u.id === worker?.user_id) || null
    const employerUser = users?.find(u => u.id === employer?.user_id) || null

    // Map contract status to booking status
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'active': 'confirmed',
      'completed': 'completed',
      'cancelled': 'cancelled'
    }

    return {
      booking_id: contract.contract_id,
      schedule_id: contract.post_id,
      status: statusMap[contract.status] || contract.status,
      booking_date: contract.created_at,
      notes: '',
      schedules: {
        schedule_id: contract.post_id,
        package_id: contract.post_id,
        employer_id: contract.employer_id,
        available_date: post?.start_date || '',
        start_time: 'N/A',
        end_time: 'N/A',
        status: contract.status
      },
      packages: {
        package_id: contract.post_id,
        worker_id: contract.worker_id,
        title: post?.title || 'Job Contract',
        description: post?.location || '',
        price: post?.salary || 0,
        availability: true
      },
      workers: worker ? {
        ...worker,
        users: workerUser ? {
          name: `${workerUser.first_name} ${workerUser.last_name}`,
          email: workerUser.email,
          phone_number: workerUser.phone_number
        } : null
      } : null,
      employers: employer ? {
        ...employer,
        users: employerUser ? {
          name: `${employerUser.first_name} ${employerUser.last_name}`,
          email: employerUser.email,
          phone_number: employerUser.phone_number
        } : null
      } : null
    }
  })

  // Combine direct hire data
  const directHireBookings = (directHires || []).map(hire => {
    const worker = workers?.find(w => w.worker_id === hire.worker_id) || null
    const employer = employers?.find(e => e.employer_id === hire.employer_id) || null
    const workerUser = users?.find(u => u.id === worker?.user_id) || null
    const employerUser = users?.find(u => u.id === employer?.user_id) || null

    // Map direct hire status to booking status
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'accepted': 'confirmed',
      'in_progress': 'confirmed',
      'paid': 'completed',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'rejected': 'cancelled'
    }

    return {
      booking_id: hire.hire_id + 100000, // Offset to avoid ID conflicts
      schedule_id: hire.hire_id,
      status: statusMap[hire.status] || hire.status,
      booking_date: hire.created_at,
      notes: '',
      schedules: {
        schedule_id: hire.hire_id,
        package_id: hire.hire_id,
        employer_id: hire.employer_id,
        available_date: hire.scheduled_date,
        start_time: 'N/A',
        end_time: 'N/A',
        status: hire.status
      },
      packages: {
        package_id: hire.hire_id,
        worker_id: hire.worker_id,
        title: 'Direct Hire',
        description: 'Direct booking',
        price: hire.total_amount || 0,
        availability: true
      },
      workers: worker ? {
        ...worker,
        users: workerUser ? {
          name: `${workerUser.first_name} ${workerUser.last_name}`,
          email: workerUser.email,
          phone_number: workerUser.phone_number
        } : null
      } : null,
      employers: employer ? {
        ...employer,
        users: employerUser ? {
          name: `${employerUser.first_name} ${employerUser.last_name}`,
          email: employerUser.email,
          phone_number: employerUser.phone_number
        } : null
      } : null
    }
  })

  const allBookings = [...contractBookings, ...directHireBookings]
  
  return { data: allBookings, count: totalCount, error: null }
}

// Get booking by ID with full details
export async function getBookingById(bookingId: number) {
  const supabase = createClient()
  
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('booking_id, schedule_id, status, booking_date, notes')
    .eq('booking_id', bookingId)
    .single()

  if (bookingError) {
    console.error('Error fetching booking:', bookingError)
    return { data: null, error: bookingError }
  }

  if (!booking) {
    return { data: null, error: null }
  }

  // Get schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from('schedules')
    .select('schedule_id, package_id, employer_id, available_date, start_time, end_time, status')
    .eq('schedule_id', booking.schedule_id)
    .single()

  if (scheduleError) {
    console.error('Error fetching schedule:', scheduleError)
    return { data: { ...booking, schedules: null, packages: null, workers: null, employers: null }, error: null }
  }

  // Get package
  const { data: packageData, error: packageError } = await supabase
    .from('packages')
    .select('package_id, worker_id, title, description, price, availability')
    .eq('package_id', schedule.package_id)
    .single()

  if (packageError) {
    console.error('Error fetching package:', packageError)
    return { data: { ...booking, schedules: schedule, packages: null, workers: null, employers: null }, error: null }
  }

  // Get worker
  const { data: worker, error: workerError } = await supabase
    .from('workers')
    .select('worker_id, user_id')
    .eq('worker_id', packageData.worker_id)
    .single()

  // Get employer
  const { data: employer, error: employerError } = await supabase
    .from('employers')
    .select('employer_id, user_id')
    .eq('employer_id', schedule.employer_id)
    .single()

  // Get users
  const userIds = [worker?.user_id, employer?.user_id].filter(Boolean)
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('user_id, name, email, phone_number, status, created_at, profile_picture')
    .in('user_id', userIds)

  const workerUser = users?.find(u => u.user_id === worker?.user_id) || null
  const employerUser = users?.find(u => u.user_id === employer?.user_id) || null

  return {
    data: {
      ...booking,
      schedules: schedule,
      packages: packageData,
      workers: worker ? { ...worker, users: workerUser } : null,
      employers: employer ? { ...employer, users: employerUser } : null,
    },
    error: null
  }
}

// Get booking analytics for line chart (weekly bookings from contracts and direct_hires)
export async function getBookingAnalytics(startDate?: Date, endDate?: Date) {
  const supabase = createClient()
  
  const now = new Date()
  let start: Date
  let end: Date

  if (startDate && endDate) {
    start = startDate
    end = endDate
  } else {
    // Default to last 5 weeks
    const fiveWeeksAgo = new Date()
    fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35)
    start = fiveWeeksAgo
    end = now
  }

  // Get all contracts in date range
  const { data: contracts, error: contractsError } = await supabase
    .from('contracts')
    .select('contract_id, created_at')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  if (contractsError) {
    console.error('Error fetching contract analytics:', contractsError)
  }

  // Get all direct hires in date range
  const { data: hires, error: hiresError } = await supabase
    .from('direct_hires')
    .select('hire_id, created_at')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())

  if (hiresError) {
    console.error('Error fetching hire analytics:', hiresError)
  }

  // Combine all bookings
  const allBookings = [
    ...(contracts || []).map(c => ({ booking_date: c.created_at })),
    ...(hires || []).map(h => ({ booking_date: h.created_at }))
  ]

  // Group by week
  const weekCounts: { [key: string]: number } = {}
  allBookings.forEach(booking => {
    const date = new Date(booking.booking_date)
    const weekNumber = getWeekNumber(date)
    const weekKey = `W${weekNumber}`
    weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1
  })

  // Convert to array format
  const weeklyData = Object.entries(weekCounts)
    .sort((a, b) => parseInt(a[0].replace('W', '')) - parseInt(b[0].replace('W', '')))
    .map(([week, bookings]) => ({
      week,
      bookings
    }))

  return {
    weeklyData,
    totalCount: allBookings.length,
    error: null
  }
}

// Helper function to get week number of the month
function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const firstDayOfWeek = firstDay.getDay()
  const dayOfMonth = date.getDate()
  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7)
}

// Get booking statistics (from contracts and direct_hires)
export async function getBookingStats() {
  const supabase = createClient()
  
  // Get counts by status from contracts
  const { count: contractPending } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: contractActive } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: contractCompleted } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed')

  const { count: contractCancelled } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'cancelled')

  const { count: contractTotal } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })

  // Get counts from direct_hires
  const { count: hirePending } = await supabase
    .from('direct_hires')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: hireAccepted } = await supabase
    .from('direct_hires')
    .select('*', { count: 'exact', head: true })
    .in('status', ['accepted', 'in_progress'])

  const { count: hireCompleted } = await supabase
    .from('direct_hires')
    .select('*', { count: 'exact', head: true })
    .in('status', ['paid', 'completed'])

  const { count: hireCancelled } = await supabase
    .from('direct_hires')
    .select('*', { count: 'exact', head: true })
    .in('status', ['cancelled', 'rejected'])

  const { count: hireTotal } = await supabase
    .from('direct_hires')
    .select('*', { count: 'exact', head: true })

  return {
    pending: (contractPending || 0) + (hirePending || 0),
    confirmed: (contractActive || 0) + (hireAccepted || 0),
    completed: (contractCompleted || 0) + (hireCompleted || 0),
    cancelled: (contractCancelled || 0) + (hireCancelled || 0),
    total: (contractTotal || 0) + (hireTotal || 0)
  }
}

// Update booking status (works with contracts and direct_hires)
export async function updateBookingStatus(bookingId: number, status: string) {
  const supabase = createClient()
  
  // Check if it's a direct hire (ID > 100000)
  if (bookingId > 100000) {
    const hireId = bookingId - 100000
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'confirmed': 'accepted',
      'completed': 'paid',
      'cancelled': 'cancelled'
    }
    const mappedStatus = statusMap[status] || status
    
    const { data, error } = await supabase
      .from('direct_hires')
      .update({ status: mappedStatus })
      .eq('hire_id', hireId)
      .select()
    
    return { data, error }
  } else {
    // It's a contract
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'confirmed': 'active',
      'completed': 'completed',
      'cancelled': 'cancelled'
    }
    const mappedStatus = statusMap[status] || status
    
    const { data, error } = await supabase
      .from('contracts')
      .update({ status: mappedStatus })
      .eq('contract_id', bookingId)
      .select()
    
    return { data, error }
  }
}

// Delete booking (works with contracts and direct_hires)
export async function deleteBooking(bookingId: number) {
  const supabase = createClient()
  
  // Check if it's a direct hire (ID > 100000)
  if (bookingId > 100000) {
    const hireId = bookingId - 100000
    const { data, error } = await supabase
      .from('direct_hires')
      .delete()
      .eq('hire_id', hireId)
    
    return { data, error }
  } else {
    // It's a contract
    const { data, error } = await supabase
      .from('contracts')
      .delete()
      .eq('contract_id', bookingId)
    
    return { data, error }
  }
}

