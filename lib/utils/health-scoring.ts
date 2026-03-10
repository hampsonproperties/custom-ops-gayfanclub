/**
 * Customer & Lead Health Scoring
 *
 * Computes a green/yellow/red health indicator for customers and leads.
 * No database calls — pure functions that work on existing data.
 */

export type HealthLevel = 'healthy' | 'at-risk' | 'dormant'

export interface HealthResult {
  level: HealthLevel
  reason: string
}

/**
 * Score a customer's health based on activity, orders, and follow-up status.
 *
 * Green (healthy): active in last 30 days, or has open projects
 * Yellow (at-risk): last activity 30-90 days ago, or has overdue follow-ups
 * Red (dormant): last activity 90+ days, or lost with no recent activity
 */
export function scoreCustomerHealth(customer: {
  updated_at?: string | null
  last_inbound_at?: string | null
  last_outbound_at?: string | null
  next_follow_up_at?: string | null
  sales_stage?: string | null
  total_orders?: number | null
  total_spent?: number | null
}): HealthResult {
  const now = new Date()

  // Find most recent activity date
  const activityDates = [
    customer.updated_at,
    customer.last_inbound_at,
    customer.last_outbound_at,
  ].filter(Boolean).map(d => new Date(d!).getTime())

  const lastActivity = activityDates.length > 0 ? Math.max(...activityDates) : 0
  const daysSinceActivity = lastActivity > 0
    ? Math.floor((now.getTime() - lastActivity) / (1000 * 60 * 60 * 24))
    : 999

  // Check for overdue follow-up
  const followUpOverdue = customer.next_follow_up_at
    ? new Date(customer.next_follow_up_at) < now
    : false

  // Lost customers with no recent activity
  if (customer.sales_stage === 'lost' && daysSinceActivity > 30) {
    return { level: 'dormant', reason: 'Lost customer' }
  }

  // Active in last 30 days
  if (daysSinceActivity <= 30) {
    return { level: 'healthy', reason: 'Active recently' }
  }

  // 30-90 days inactive
  if (daysSinceActivity <= 90) {
    if (followUpOverdue) {
      return { level: 'at-risk', reason: `Follow-up overdue` }
    }
    return { level: 'at-risk', reason: `${daysSinceActivity}d since activity` }
  }

  // 90+ days
  return { level: 'dormant', reason: `${daysSinceActivity}d inactive` }
}

/**
 * Score a lead's health based on progress, contact, and staleness.
 *
 * Green: contacted in last 7 days, or new lead (<7 days old)
 * Yellow: no contact in 7-14 days, or follow-up overdue
 * Red: no contact in 14+ days, or stuck with no progress
 */
export function scoreLeadHealth(lead: {
  created_at?: string | null
  last_contact_at?: string | null
  next_follow_up_at?: string | null
  status?: string | null
  updated_at?: string | null
}): HealthResult {
  const now = new Date()

  const createdAt = lead.created_at ? new Date(lead.created_at) : now
  const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  // Use last_contact_at or updated_at as proxy for last activity
  const lastContactDate = lead.last_contact_at || lead.updated_at
  const daysSinceContact = lastContactDate
    ? Math.floor((now.getTime() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
    : daysSinceCreation

  const followUpOverdue = lead.next_follow_up_at
    ? new Date(lead.next_follow_up_at) < now
    : false

  // New lead, created in last 7 days
  if (daysSinceCreation <= 7) {
    return { level: 'healthy', reason: 'New lead' }
  }

  // Contacted recently (last 7 days)
  if (daysSinceContact <= 7) {
    return { level: 'healthy', reason: 'Recently active' }
  }

  // 7-14 days without contact
  if (daysSinceContact <= 14) {
    if (followUpOverdue) {
      return { level: 'at-risk', reason: 'Follow-up overdue' }
    }
    return { level: 'at-risk', reason: `${daysSinceContact}d since contact` }
  }

  // 14+ days stale
  return { level: 'dormant', reason: `${daysSinceContact}d stale` }
}
