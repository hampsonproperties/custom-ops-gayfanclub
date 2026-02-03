import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

type TimelineEvent = {
  id: string
  type: 'status_change' | 'email' | 'file_upload' | 'work_item_created' | 'note'
  timestamp: string
  title: string
  description: string
  metadata?: any
  user?: string
}

export function useTimeline(workItemId: string) {
  return useQuery({
    queryKey: ['timeline', workItemId],
    queryFn: async () => {
      const supabase = createClient()
      const events: TimelineEvent[] = []

      // Get work item creation
      const { data: workItem } = await supabase
        .from('work_items')
        .select('created_at, type, source, customer_name')
        .eq('id', workItemId)
        .single()

      if (workItem) {
        events.push({
          id: `created-${workItemId}`,
          type: 'work_item_created',
          timestamp: workItem.created_at,
          title: 'Work Item Created',
          description: `${workItem.type === 'customify_order' ? 'Customify order' : 'Custom design project'} created from ${workItem.source}`,
          metadata: { source: workItem.source, type: workItem.type },
        })
      }

      // Get status changes
      const { data: statusEvents } = await supabase
        .from('work_item_status_events')
        .select(`
          id,
          created_at,
          from_status,
          to_status,
          note,
          changed_by_user_id,
          users:changed_by_user_id (full_name)
        `)
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: false })

      if (statusEvents) {
        statusEvents.forEach((event: any) => {
          events.push({
            id: event.id,
            type: 'status_change',
            timestamp: event.created_at,
            title: `Status Changed`,
            description: `${event.from_status || 'none'} → ${event.to_status}${event.note ? `: ${event.note}` : ''}`,
            metadata: { from: event.from_status, to: event.to_status },
            user: event.users?.full_name || 'System',
          })
        })
      }

      // Get email communications
      const { data: communications } = await supabase
        .from('communications')
        .select('id, direction, subject, body_preview, received_at, from_email, to_emails')
        .eq('work_item_id', workItemId)
        .order('received_at', { ascending: false })

      if (communications) {
        communications.forEach((comm) => {
          events.push({
            id: comm.id,
            type: 'email',
            timestamp: comm.received_at || new Date().toISOString(),
            title: comm.direction === 'inbound' ? 'Email Received' : 'Email Sent',
            description: comm.subject || 'No subject',
            metadata: {
              direction: comm.direction,
              from: comm.from_email,
              to: comm.to_emails,
              preview: comm.body_preview,
            },
          })
        })
      }

      // Get file uploads
      const { data: files } = await supabase
        .from('files')
        .select(`
          id,
          created_at,
          kind,
          original_filename,
          note,
          uploaded_by_user_id,
          users:uploaded_by_user_id (full_name)
        `)
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: false })

      if (files) {
        files.forEach((file: any) => {
          // Filter out backfill notes to avoid confusing UI
          const displayNote = file.note && !file.note.startsWith('Backfilled') ? file.note : null

          events.push({
            id: file.id,
            type: 'file_upload',
            timestamp: file.created_at,
            title: 'File Uploaded',
            description: `${file.kind} file: ${file.original_filename}${displayNote ? ` - ${displayNote}` : ''}`,
            metadata: { kind: file.kind, filename: file.original_filename },
            user: file.users?.full_name || 'Customer',
          })
        })
      }

      // Sort all events by timestamp (most recent first)
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      return events
    },
    enabled: !!workItemId,
  })
}
