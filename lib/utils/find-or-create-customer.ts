import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const log = logger('find-or-create-customer')

/**
 * Find or create a customer record by email address.
 *
 * Simpler than the Shopify-specific findOrCreateCustomer (lib/shopify/customer-orders.ts)
 * — works with just an email and name, no Shopify data needed.
 *
 * - If a customer with this email exists, returns their ID (does NOT overwrite their data)
 * - If no customer exists, creates one with sales_stage='new_lead'
 * - Handles race conditions (unique constraint violation → re-fetch)
 * - Returns null if no email provided
 */
export async function findOrCreateCustomerByEmail(
  supabase: SupabaseClient,
  email: string | null | undefined,
  name: string | null | undefined
): Promise<string | null> {
  if (!email) return null

  const normalizedEmail = email.toLowerCase().trim()

  try {
    // Try to find existing customer by email
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (existing) {
      log.info('Found existing customer', { email: normalizedEmail, customerId: existing.id })
      return existing.id
    }

    // Parse name into first/last
    const nameParts = (name || '').trim().split(/\s+/)
    const firstName = nameParts[0] || null
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
    const displayName = name?.trim() || normalizedEmail

    // Create new customer
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        email: normalizedEmail,
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        customer_type: 'individual',
        sales_stage: 'new_lead',
      })
      .select('id')
      .single()

    if (error) {
      // Handle race condition: another process created this customer between our check and insert
      if (error.code === '23505') {
        log.info('Race condition: customer created by another process, re-fetching', { email: normalizedEmail })
        const { data: retried } = await supabase
          .from('customers')
          .select('id')
          .ilike('email', normalizedEmail)
          .maybeSingle()
        return retried?.id || null
      }
      log.error('Failed to create customer', { error, email: normalizedEmail })
      return null
    }

    log.info('Created new customer', { email: normalizedEmail, customerId: newCustomer.id })
    return newCustomer.id
  } catch (error) {
    log.error('Error in findOrCreateCustomerByEmail', { error, email: normalizedEmail })
    return null
  }
}
