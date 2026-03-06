'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribe to Supabase Realtime changes on the `communications` table.
 * When a new email is inserted or an existing one is updated (e.g. triaged
 * by another staff member), we invalidate the relevant TanStack Query caches
 * so the inbox re-fetches automatically — no manual refresh needed.
 *
 * Prerequisites: Realtime replication must be enabled on the `communications`
 * table in the Supabase dashboard (Database → Replication).
 */
export function useRealtimeEmails() {
  const queryClient = useQueryClient()
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('inbox-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'communications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['communications'] })
          queryClient.invalidateQueries({ queryKey: ['inbox-replies'] })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'communications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['communications'] })
          queryClient.invalidateQueries({ queryKey: ['inbox-replies'] })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [queryClient])
}

/**
 * Subscribe to Supabase Realtime changes on the `notifications` table.
 * Replaces the 60-second polling interval with instant updates — the badge
 * count refreshes the moment a new notification is created by the cron job.
 *
 * Prerequisites: Realtime replication must be enabled on the `notifications`
 * table in the Supabase dashboard (Database → Replication).
 */
export function useRealtimeNotifications() {
  const queryClient = useQueryClient()
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [queryClient])
}
