/**
 * Email Auto-Linker
 *
 * Automatically links recent unassigned emails from a customer
 * to a newly created work item. Looks back 30 days from the order date.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { EMAIL_AUTOLINK_LOOKBACK_DAYS } from '@/lib/config'

const log = logger('shopify-email-linker')

/**
 * Auto-links recent unattached emails from a customer to a work item.
 *
 * For design fee orders, includes emails up to the current time.
 * For other orders, only includes emails up to the order creation date.
 *
 * @returns Number of emails linked
 */
export async function autoLinkEmails(
  supabase: SupabaseClient,
  customerEmail: string,
  workItemId: string,
  orderCreatedAt: string,
  orderType: string
): Promise<number> {
  const orderDate = new Date(orderCreatedAt)
  const lookbackDate = new Date(orderDate)
  lookbackDate.setDate(lookbackDate.getDate() - EMAIL_AUTOLINK_LOOKBACK_DAYS)

  // For design fee orders, include emails up to NOW (they might come in after the order)
  const upperBoundDate = orderType === 'custom_design_service'
    ? new Date()
    : orderDate

  const { data: recentEmails } = await supabase
    .from('communications')
    .select('id')
    .eq('from_email', customerEmail)
    .is('work_item_id', null)
    .gte('received_at', lookbackDate.toISOString())
    .lte('received_at', upperBoundDate.toISOString())

  if (!recentEmails || recentEmails.length === 0) return 0

  await supabase
    .from('communications')
    .update({
      work_item_id: workItemId,
      triage_status: 'attached',
    })
    .in('id', recentEmails.map((e: any) => e.id))

  log.info('Auto-linked emails to work item', { count: recentEmails.length, workItemId })
  return recentEmails.length
}
