'use client'

import { useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'

const log = logger('email-subscription')

/**
 * Auto-renews email subscription on dashboard load
 * - Checks if subscription is active and valid
 * - Renews if expired or expiring within 24 hours
 * - Imports any missed emails from last 3 days
 * - Runs once per session (not on every page navigation)
 */
export function useEmailSubscription() {
  const hasChecked = useRef(false)

  useEffect(() => {
    // Only check once per session
    if (hasChecked.current) return
    hasChecked.current = true

    // Run in background, don't block UI
    const checkSubscription = async () => {
      try {
        const response = await fetch('/api/email/check-subscription', {
          method: 'POST',
        })

        if (!response.ok) {
          log.error('Email subscription check failed', { statusText: response.statusText })
          return
        }

        const result = await response.json()
        log.info('Email subscription status', { status: result.status })

        if (result.status === 'renewed') {
          log.info('Email subscription renewed', { expiresAt: result.expiresAt })
        } else if (result.status === 'active') {
          log.info('Email subscription active', { expiresAt: result.expiresAt })
        }
      } catch (error) {
        log.error('Email subscription check error', { error })
        // Fail silently - don't break the dashboard
      }
    }

    // Delay slightly to not block initial page load
    const timer = setTimeout(checkSubscription, 2000)
    return () => clearTimeout(timer)
  }, [])
}
