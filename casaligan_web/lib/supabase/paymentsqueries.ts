import { createClient } from './client'

/**
 * Payment-specific queries for admin dashboard
 */

// Get all payments with related information using Supabase relational queries
export async function getPayments(limit = 50, offset = 0, status?: string, searchQuery?: string) {
  const supabase = createClient()
  
  // Build query with nested relational selects for better performance
  let query = supabase
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
    `, { count: 'exact' })
    .order('payment_date', { ascending: false })
    .range(offset, offset + limit - 1)

  // Apply status filter if provided
  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: payments, error: paymentsError, count } = await query

  if (paymentsError) {
    console.error('Error fetching payments:', paymentsError)
    return { data: [], count: 0, error: paymentsError }
  }

  if (!payments || payments.length === 0) {
    return { data: [], count: count || 0, error: null }
  }

  // Transform the nested structure to match the expected format
  // Note: Supabase returns arrays for relational queries, so we need to handle the first element
  const paymentsWithDetails = payments.map((payment: any) => {
    // Handle arrays from Supabase relational queries
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
    }
  })

  // Apply search filter if provided (search in employer name, worker name, amount)
  let filteredPayments = paymentsWithDetails
  if (searchQuery && searchQuery.trim()) {
    const search = searchQuery.toLowerCase().trim()
    filteredPayments = paymentsWithDetails.filter(payment => {
      const employerName = payment.employers?.users?.name?.toLowerCase() || ''
      const workerName = payment.workers?.users?.name?.toLowerCase() || ''
      const amount = String(payment.amount || '').toLowerCase()
      const paymentId = String(payment.payment_id || '').toLowerCase()
      
      return employerName.includes(search) || 
             workerName.includes(search) || 
             amount.includes(search) ||
             paymentId.includes(search)
    })
  }

  return { data: filteredPayments, count: count || 0, error: null }
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

// Get payment statistics
export async function getPaymentStats() {
  const supabase = createClient()
  
  try {
    // Get counts by status in parallel for better performance
    const [pendingResult, completedResult, failedResult, refundedResult, totalResult] = await Promise.all([
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'refunded'),
      supabase.from('payments').select('*', { count: 'exact', head: true })
    ])

    // Get total amount for completed payments
    const { data: allPayments, error: amountError } = await supabase
      .from('payments')
      .select('amount, status, payment_date')
      .eq('status', 'completed')

    if (amountError) {
      console.error('Error fetching payment amounts:', amountError)
    }

    const totalAmount = allPayments?.reduce((sum, p) => sum + (parseFloat(p.amount.toString()) || 0), 0) || 0

    // Get overdue payments count (pending payments past their payment_date)
    const { data: pendingPayments, error: overdueError } = await supabase
      .from('payments')
      .select('payment_id, payment_date, status')
      .eq('status', 'pending')

    if (overdueError) {
      console.error('Error fetching overdue payments:', overdueError)
    }

    const now = new Date()
    const overdueCount = pendingPayments?.filter(p => {
      if (!p.payment_date) return false
      const paymentDate = new Date(p.payment_date)
      return paymentDate < now
    }).length || 0

    return {
      pending: pendingResult.count || 0,
      completed: completedResult.count || 0,
      failed: failedResult.count || 0,
      refunded: refundedResult.count || 0,
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

// Update payment status
export async function updatePaymentStatus(paymentId: number, status: string) {
  const supabase = createClient()
  
  // Validate status
  const validStatuses = ['pending', 'completed', 'failed', 'refunded', 'cancelled']
  if (!validStatuses.includes(status.toLowerCase())) {
    return { 
      data: null, 
      error: { message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` } as any
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .update({ status: status.toLowerCase() })
    .eq('payment_id', paymentId)
    .select()
  
  if (error) {
    console.error('Error updating payment status:', error)
  }
  
  return { data, error }
}

// Delete payment (hard delete)
export async function deletePayment(paymentId: number) {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('payments')
    .delete()
    .eq('payment_id', paymentId)
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

