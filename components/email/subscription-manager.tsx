'use client'

import { useEmailSubscription } from '@/lib/hooks/use-email-subscription'

/**
 * Silent background component that auto-renews email subscriptions
 * Add this to your dashboard layout to ensure email webhooks stay active
 */
export function EmailSubscriptionManager() {
  useEmailSubscription()
  return null // Renders nothing, just runs the hook
}
