/**
 * Global auto-email toggle.
 *
 * Defaults to OFF — no automatic customer-facing emails are sent
 * until the toggle is explicitly enabled in Settings.
 *
 * Gated emails:
 * - Batch drip sequence (cron: process-batch-drip-emails)
 * - Batch email queue sender (cron: process-batch-emails)
 *
 * NOT gated (user-triggered, intentional):
 * - Proof approval emails (send-approval-email)
 * - Priority alert cron (goes to team, not customers)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Check if automatic customer emails are enabled.
 * Accepts any Supabase client (auth or service-role).
 */
export async function getAutoEmailsEnabled(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'auto_emails_enabled')
      .single()

    if (error || !data) return false // Default: OFF
    return data.value === true || data.value === 'true'
  } catch {
    return false // Default: OFF
  }
}
