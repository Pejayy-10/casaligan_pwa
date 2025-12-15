import { createClient } from './client'

/**
 * Payment-specific queries for admin dashboard
 */

// Get all payments with related information from direct_hires table
export async function getPayments(limit = 50, offset = 0, status?: string, searchQuery?: string) {
  const supabase = createClient()
  
  // Fetch from direct_hires table which contains payment information
  let directHiresQuery = supabase
    .from('direct_hires')
    .select(`
      hire_id,
      employer_id,
      worker_id,
      total_amount,
      scheduled_date,
      scheduled_time,
      status,
      payment_method,
      payment_proof_url,
      reference_number,
      paid_at,
      created_at,
      employers:employer_id (
        employer_id,
        user_id,
        users:user_id (
          id,
          name,
          first_name,
          last_name,
          email,
          phone_number,
          status,
          profile_picture
        )
      ),
      workers:worker_id (
        worker_id,
        user_id,
        users:user_id (
          id,
          name,
          first_name,
          last_name,
          email,
          phone_number,
          status,
          profile_picture
        )
      )
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  // Apply status filter if provided - filter for paid hires
  if (status && status !== 'all') {
    if (status === 'completed' || status === 'paid') {
      directHiresQuery = directHiresQuery.eq('status', 'paid')
    } else if (status === 'pending') {
      directHiresQuery = directHiresQuery.in('status', ['completed', 'in_progress'])
    } else {
      directHiresQuery = directHiresQuery.eq('status', status)
    }
  }

  const { data: hires, error: hiresError, count: hiresCount } = await directHiresQuery

  if (hiresError) {
    console.error('Error fetching payments from direct_hires:', hiresError)
    return { data: [], count: 0, error: hiresError }
  }

  // Fetch from payment_transactions (job posting payments)
  let transactionsQuery = supabase
    .from('payment_transactions')
    .select(`
      transaction_id,
      schedule_id,
      amount_paid,
      payment_method,
      payment_proof_url,
      reference_number,
      paid_at,
      payment_schedules:schedule_id (
        schedule_id,
        contract_id,
        worker_id,
        worker_name,
        due_date,
        amount,
        status,
        contracts:contract_id (
          contract_id,
          post_id,
          employer_id,
          forumposts:post_id (
            post_id,
            title,
            salary
          )
        ),
        workers:worker_id (
          worker_id,
          user_id,
          users:user_id (
            id,
            name,
            first_name,
            last_name,
            email,
            phone_number,
            status,
            profile_picture
          )
        )
      )
    `, { count: 'exact' })
    .order('paid_at', { ascending: false })

  const { data: transactions, error: transactionsError, count: transactionsCount } = await transactionsQuery

  if (transactionsError) {
    console.error('Error fetching payment transactions:', transactionsError)
  }

  // Fetch employer data for job post payments
  const employerIds = (transactions || [])
    .map((trans: any) => {
      const schedule = Array.isArray(trans.payment_schedules) ? trans.payment_schedules[0] : trans.payment_schedules || null
      const contract = Array.isArray(schedule?.contracts) ? schedule.contracts[0] : schedule?.contracts || null
      return contract?.employer_id
    })
    .filter(Boolean)

  let employersMap: Record<number, any> = {}
  if (employerIds.length > 0) {
    const { data: employers } = await supabase
      .from('employers')
      .select(`
        employer_id,
        user_id,
        users:user_id (
          id,
          name,
          first_name,
          last_name,
          email,
          phone_number,
          status,
          profile_picture
        )
      `)
      .in('employer_id', employerIds)
    
    if (employers) {
      employers.forEach((emp: any) => {
        employersMap[emp.employer_id] = emp
      })
    }
  }

  // Transform direct_hires data to match payment format
  const directHirePayments = (hires || []).map((hire: any) => {
    // Handle arrays from Supabase relational queries
    const employer = Array.isArray(hire.employers) ? hire.employers[0] : hire.employers || null
    const worker = Array.isArray(hire.workers) ? hire.workers[0] : hire.workers || null
    
    // Handle nested user arrays
    const employerUser = Array.isArray(employer?.users) ? employer.users[0] : employer?.users || null
    const workerUser = Array.isArray(worker?.users) ? worker.users[0] : worker?.users || null

    return {
      payment_id: `DH-${hire.hire_id}`,
      hire_id: hire.hire_id,
      amount: hire.total_amount,
      status: hire.status === 'paid' ? 'completed' : hire.status,
      payment_date: hire.paid_at || hire.created_at,
      payment_method: hire.payment_method,
      reference_number: hire.reference_number,
      payment_type: 'direct_hire',
      workers: worker ? {
        worker_id: worker.worker_id,
        user_id: worker.user_id,
        users: workerUser
      } : null,
      employers: employer ? {
        employer_id: employer.employer_id,
        user_id: employer.user_id,
        users: employerUser
      } : null,
      payment_methods: hire.payment_method ? {
        provider_name: hire.payment_method
      } : null,
      bookings: {
        booking_date: hire.created_at
      }
    }
  })

  // Transform payment_transactions data to match payment format
  const jobPostPayments = (transactions || []).map((trans: any) => {
    const schedule = Array.isArray(trans.payment_schedules) ? trans.payment_schedules[0] : trans.payment_schedules || null
    const contract = Array.isArray(schedule?.contracts) ? schedule.contracts[0] : schedule?.contracts || null
    const forumpost = Array.isArray(contract?.forumposts) ? contract.forumposts[0] : contract?.forumposts || null
    const worker = Array.isArray(schedule?.workers) ? schedule.workers[0] : schedule?.workers || null
    const workerUser = Array.isArray(worker?.users) ? worker.users[0] : worker?.users || null

    // Get employer from map
    const employerId = contract?.employer_id
    const employer = employerId ? employersMap[employerId] : null
    const employerUser = Array.isArray(employer?.users) ? employer.users[0] : employer?.users || null

    return {
      payment_id: `JP-${trans.transaction_id}`,
      transaction_id: trans.transaction_id,
      schedule_id: trans.schedule_id,
      amount: trans.amount_paid,
      status: 'completed', // Transactions are always completed
      payment_date: trans.paid_at,
      payment_method: trans.payment_method,
      reference_number: trans.reference_number,
      payment_type: 'job_post',
      job_title: forumpost?.title || 'Job Post Payment',
      workers: worker ? {
        worker_id: worker.worker_id,
        user_id: worker.user_id,
        users: workerUser
      } : (schedule?.worker_name ? {
        worker_id: null,
        user_id: null,
        users: { name: schedule.worker_name }
      } : null),
      employers: employer ? {
        employer_id: employer.employer_id,
        user_id: employer.user_id,
        users: employerUser
      } : null,
      payment_methods: trans.payment_method ? {
        provider_name: trans.payment_method
      } : null,
      bookings: {
        booking_date: trans.paid_at
      }
    }
  })

  // Combine both payment sources
  let allPayments = [...directHirePayments, ...jobPostPayments]
  
  // Sort by payment date (most recent first)
  allPayments.sort((a, b) => {
    const dateA = new Date(a.payment_date || 0).getTime()
    const dateB = new Date(b.payment_date || 0).getTime()
    return dateB - dateA
  })

  // Apply search filter if provided (search in employer name, worker name, amount)
  let filteredPayments = allPayments
  if (searchQuery && searchQuery.trim()) {
    const search = searchQuery.toLowerCase().trim()
    filteredPayments = allPayments.filter(payment => {
      const employerName = payment.employers?.users?.name?.toLowerCase() || ''
      const workerName = payment.workers?.users?.name?.toLowerCase() || ''
      const amount = String(payment.amount || '').toLowerCase()
      const paymentId = String(payment.payment_id || '').toLowerCase()
      const jobTitle = payment.job_title?.toLowerCase() || ''
      
      return employerName.includes(search) || 
             workerName.includes(search) || 
             amount.includes(search) ||
             paymentId.includes(search) ||
             jobTitle.includes(search)
    })
  }

  // Apply pagination
  const paginatedPayments = filteredPayments.slice(offset, offset + limit)
  const totalCount = (hiresCount || 0) + (transactionsCount || 0)

  return { data: paginatedPayments, count: totalCount, error: null }
}

// Get payment by ID with full details using relational queries
export async function getPaymentById(paymentId: number) {
  const supabase = createClient()
  
  const { data: payment, error: paymentError } = await supabase
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
        terms,
        bookings:booking_id (
          booking_id,
          schedule_id,
          status,
          booking_date,
          notes,
          schedules:schedule_id (
            schedule_id,
            package_id,
            employer_id,
            available_date,
            start_time,
            end_time,
            status,
            packages:package_id (
              package_id,
              worker_id,
              title,
              description,
              price,
              availability,
              workers:worker_id (
                worker_id,
                user_id,
                users:user_id (
                  user_id,
                  name,
                  email,
                  phone_number,
                  status,
                  created_at,
                  profile_picture
                )
              )
            ),
            employers:employer_id (
              employer_id,
              user_id,
              users:user_id (
                user_id,
                name,
                email,
                phone_number,
                status,
                created_at,
                profile_picture
              )
            )
          )
        )
      ),
      payment_methods:method_id (
        method_id,
        provider_name,
        details
      )
    `)
    .eq('payment_id', paymentId)
    .single()

  if (paymentError) {
    console.error('Error fetching payment:', paymentError)
    return { data: null, error: paymentError }
  }

  if (!payment) {
    return { data: null, error: null }
  }

  // Transform the nested structure to match the expected format
  // Note: Supabase returns arrays for relational queries, so we need to handle the first element
  const contract = Array.isArray(payment.contracts) ? payment.contracts[0] : payment.contracts || null
  const booking = Array.isArray(contract?.bookings) ? contract.bookings[0] : contract?.bookings || null
  const schedule = Array.isArray(booking?.schedules) ? booking.schedules[0] : booking?.schedules || null
  const packageData = Array.isArray(schedule?.packages) ? schedule.packages[0] : schedule?.packages || null
  const worker = Array.isArray(packageData?.workers) ? packageData.workers[0] : packageData?.workers || null
  const employer = Array.isArray(schedule?.employers) ? schedule.employers[0] : schedule?.employers || null
  const paymentMethod = Array.isArray(payment.payment_methods) ? payment.payment_methods[0] : payment.payment_methods || null

  // Handle nested user arrays
  const workerUser = Array.isArray(worker?.users) ? worker.users[0] : worker?.users || null
  const employerUser = Array.isArray(employer?.users) ? employer.users[0] : employer?.users || null

  return {
    data: {
      payment_id: payment.payment_id,
      contract_id: payment.contract_id,
      method_id: payment.method_id,
      amount: payment.amount,
      status: payment.status,
      payment_date: payment.payment_date,
      contracts: contract ? {
        contract_id: contract.contract_id,
        booking_id: contract.booking_id,
        terms: contract.terms
      } : null,
      bookings: booking ? {
        booking_id: booking.booking_id,
        schedule_id: booking.schedule_id,
        status: booking.status,
        booking_date: booking.booking_date,
        notes: booking.notes
      } : null,
      schedules: schedule ? {
        schedule_id: schedule.schedule_id,
        package_id: schedule.package_id,
        employer_id: schedule.employer_id,
        available_date: schedule.available_date,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        status: schedule.status
      } : null,
      packages: packageData ? {
        package_id: packageData.package_id,
        worker_id: packageData.worker_id,
        title: packageData.title,
        description: packageData.description,
        price: packageData.price,
        availability: packageData.availability
      } : null,
      workers: worker ? {
        worker_id: worker.worker_id,
        user_id: worker.user_id,
        users: workerUser
      } : null,
      employers: employer ? {
        employer_id: employer.employer_id,
        user_id: employer.user_id,
        users: employerUser
      } : null,
      payment_methods: paymentMethod ? {
        method_id: paymentMethod.method_id,
        provider_name: paymentMethod.provider_name,
        details: paymentMethod.details
      } : null
    },
    error: null
  }
}

// Get payment statistics from direct_hires
export async function getPaymentStats() {
  const supabase = createClient()
  
  try {
    // Get counts by status in parallel - use direct_hires table
    const [pendingResult, completedResult, cancelledResult, totalResult] = await Promise.all([
      supabase.from('direct_hires').select('*', { count: 'exact', head: true }).in('status', ['completed', 'in_progress']),
      supabase.from('direct_hires').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
      supabase.from('direct_hires').select('*', { count: 'exact', head: true }).eq('status', 'cancelled'),
      supabase.from('direct_hires').select('*', { count: 'exact', head: true })
    ])

    // Get total amount for paid hires
    const { data: paidHires, error: amountError } = await supabase
      .from('direct_hires')
      .select('total_amount, status, paid_at')
      .eq('status', 'paid')

    if (amountError) {
      console.error('Error fetching payment amounts:', amountError)
    }

    const totalAmount = paidHires?.reduce((sum, p) => sum + (parseFloat(p.total_amount?.toString() || '0') || 0), 0) || 0

    // Get overdue payments count (completed hires not yet paid)
    const { data: completedHires, error: overdueError } = await supabase
      .from('direct_hires')
      .select('hire_id, completed_at, status')
      .eq('status', 'completed')

    if (overdueError) {
      console.error('Error fetching overdue payments:', overdueError)
    }

    // Hires completed more than 7 days ago without payment are overdue
    const now = new Date()
    const overdueCount = completedHires?.filter(h => {
      if (!h.completed_at) return false
      const completedDate = new Date(h.completed_at)
      const daysSinceCompletion = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
      return daysSinceCompletion > 7
    }).length || 0

    return {
      pending: pendingResult.count || 0,
      completed: completedResult.count || 0,
      failed: 0, // Not tracked in direct_hires
      refunded: 0, // Not tracked in direct_hires
      overdue: overdueCount,
      total: totalResult.count || 0,
      totalAmount: totalAmount
    }
  } catch (error) {
    console.error('Error fetching payment statistics:', error)
    return {
      pending: 0,
      completed: 0,
      failed: 0,
      refunded: 0,
      overdue: 0,
      total: 0,
      totalAmount: 0
    }
  }
}

// Update payment status - updates direct_hire status
export async function updatePaymentStatus(hireId: number, status: string) {
  const supabase = createClient()
  
  // Validate status - map payment statuses to direct_hire statuses
  const statusMap: { [key: string]: string } = {
    'completed': 'paid',
    'paid': 'paid',
    'pending': 'completed',
    'cancelled': 'cancelled'
  }
  
  const mappedStatus = statusMap[status.toLowerCase()]
  if (!mappedStatus) {
    return { 
      data: null, 
      error: { message: `Invalid status. Must be one of: ${Object.keys(statusMap).join(', ')}` } as any
    }
  }

  const updateData: any = { status: mappedStatus }
  
  // If marking as paid, set paid_at timestamp
  if (mappedStatus === 'paid') {
    updateData.paid_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('direct_hires')
    .update(updateData)
    .eq('hire_id', hireId)
    .select()
  
  if (error) {
    console.error('Error updating payment status:', error)
  }
  
  return { data, error }
}

// Delete payment (hard delete from direct_hires)
export async function deletePayment(hireId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('direct_hires')
    .delete()
    .eq('hire_id', hireId)
    .select()
  
  if (error) {
    console.error('Error deleting payment:', error)
  }
  
  return { data, error }
}

// Get overdue payments
export async function getOverduePayments(limit = 50, offset = 0) {
  const supabase = createClient()
  const now = new Date().toISOString()
  
  const { data: payments, error, count } = await supabase
    .from('payments')
    .select('payment_id, contract_id, method_id, amount, status, payment_date', { count: 'exact' })
    .eq('status', 'pending')
    .lt('payment_date', now)
    .order('payment_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching overdue payments:', error)
    return { data: [], count: 0, error }
  }

  return { data: payments || [], count: count || 0, error: null }
}

// Create a new payment
export async function createPayment(paymentData: {
  contract_id: number
  method_id?: number | null
  amount: number
  status: string
  payment_date?: string
}) {
  const supabase = createClient()
  
  // Validate required fields
  if (!paymentData.contract_id || !paymentData.amount) {
    return { 
      data: null, 
      error: { message: 'contract_id and amount are required' } as any
    }
  }

  // Validate status
  const validStatuses = ['pending', 'completed', 'failed', 'refunded', 'cancelled']
  if (!validStatuses.includes(paymentData.status.toLowerCase())) {
    return { 
      data: null, 
      error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } as any
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .insert({
      contract_id: paymentData.contract_id,
      method_id: paymentData.method_id || null,
      amount: paymentData.amount,
      status: paymentData.status.toLowerCase(),
      payment_date: paymentData.payment_date || new Date().toISOString()
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating payment:', error)
  }

  return { data, error }
}

