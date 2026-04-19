import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const WEEK_BUCKETS = 5

const startOfWeek = (value: Date) => {
  const date = new Date(value)
  const day = date.getDay()
  const diff = (day + 6) % 7
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}

const buildWeekBuckets = (count: number) => {
  const weeks: { start: Date; end: Date }[] = []
  const currentWeekStart = startOfWeek(new Date())
  const firstWeekStart = new Date(currentWeekStart)
  firstWeekStart.setDate(firstWeekStart.getDate() - (count - 1) * 7)

  for (let i = 0; i < count; i += 1) {
    const start = new Date(firstWeekStart)
    start.setDate(firstWeekStart.getDate() + (i * 7))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    weeks.push({ start, end })
  }

  return weeks
}

const toNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const weekBuckets = buildWeekBuckets(WEEK_BUCKETS)
  const defaultStart = weekBuckets[0]?.start?.toISOString() ?? new Date().toISOString()

  const { searchParams } = new URL(request.url)
  const startDateParam = searchParams.get('startDate')
  const endDateParam = searchParams.get('endDate')

  const hasValidStart = Boolean(startDateParam && !Number.isNaN(new Date(startDateParam).getTime()))
  const hasValidEnd = Boolean(endDateParam && !Number.isNaN(new Date(endDateParam).getTime()))

  const rangeStart = hasValidStart ? new Date(`${startDateParam}T00:00:00.000Z`).toISOString() : defaultStart
  const rangeEnd = hasValidEnd ? new Date(`${endDateParam}T23:59:59.999Z`).toISOString() : null

  let directHireQuery = supabase
    .from('direct_hires')
    .select('platform_fee_amount, platform_fee_status, payment_method, paid_at, created_at')
    .gte('created_at', rangeStart)

  let paymentTransactionsQuery = supabase
    .from('payment_transactions')
    .select('amount_paid, payment_method, paid_at')
    .gte('paid_at', rangeStart)

  if (rangeEnd) {
    directHireQuery = directHireQuery.lte('created_at', rangeEnd)
    paymentTransactionsQuery = paymentTransactionsQuery.lte('paid_at', rangeEnd)
  }

  const [directHireFeesResult, paymentTransactionsResult] = await Promise.all([
    directHireQuery,
    paymentTransactionsQuery,
  ])

  const revenueByCategory: Record<string, number> = {}

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

  const revenueByWeek = Object.entries(revenueByCategory)
    .map(([category, total]) => ({
      category,
      revenue: Number(total.toFixed(2)),
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const error = directHireFeesResult.error || paymentTransactionsResult.error || null

  if (error) {
    return NextResponse.json({ data: [], error: error.message || 'Failed to load revenue categories' }, { status: 500 })
  }

  return NextResponse.json({ data: revenueByWeek, error: null })
}
