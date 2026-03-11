import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

type TimelineEvent = {
  id: string
  type: 'status_change' | 'email' | 'file_upload' | 'work_item_created' | 'note' | 'call' | 'text' | 'task' | 'appointment'
  timestamp: string
  title: string
  description: string
  content?: string
  metadata?: any
  user?: string
  userEmail?: string
  starred?: boolean
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
        .select('created_at, type, source, customer_name, created_by_user_id, created_by:users!work_items_created_by_user_id_fkey(full_name, email)')
        .eq('id', workItemId)
        .single()

      if (workItem) {
        const createdBy = (workItem as any).created_by as { full_name: string | null; email: string | null } | null
        const creatorName = createdBy?.full_name || createdBy?.email?.split('@')[0] || null
        const sourceLabel = workItem.source === 'form' ? 'form submission' : workItem.source
        const description = creatorName
          ? `Created by ${creatorName} from ${sourceLabel}`
          : `${workItem.type === 'customify_order' ? 'Customify order' : 'Custom design project'} created from ${sourceLabel}`

        events.push({
          id: `created-${workItemId}`,
          type: 'work_item_created',
          timestamp: workItem.created_at,
          title: 'Work Item Created',
          description,
          metadata: { source: workItem.source, type: workItem.type },
          user: creatorName || (workItem.source === 'shopify' ? 'Shopify' : workItem.source === 'form' ? 'Form Submission' : undefined),
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
        .select('id, direction, subject, body_preview, body_html, received_at, from_email, to_emails')
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
              html: comm.body_html,
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
          external_url,
          mime_type,
          storage_bucket,
          storage_path,
          uploaded_by_user_id,
          users:uploaded_by_user_id (full_name, email)
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
            metadata: { kind: file.kind, filename: file.original_filename, fileId: file.id, externalUrl: file.external_url, mimeType: file.mime_type, storageBucket: file.storage_bucket, storagePath: file.storage_path },
            user: file.users?.full_name || 'Customer',
            userEmail: file.users?.email,
          })
        })
      }

      // Get notes
      const { data: notes } = await supabase
        .from('work_item_notes')
        .select(`
          id,
          content,
          created_at,
          starred,
          author_email,
          created_by_user_id,
          users:created_by_user_id (full_name, email)
        `)
        .eq('work_item_id', workItemId)
        .order('created_at', { ascending: false })

      if (notes) {
        notes.forEach((note: any) => {
          events.push({
            id: note.id,
            type: 'note',
            timestamp: note.created_at,
            title: 'Note',
            description: note.content.substring(0, 200) + (note.content.length > 200 ? '...' : ''),
            content: note.content,
            user: note.users?.full_name || note.author_email?.split('@')[0] || 'Unknown',
            userEmail: note.users?.email || note.author_email,
            starred: note.starred || false,
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

export function useToggleTimelineStar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ eventId, eventType }: { eventId: string; eventType: string }) => {
      const supabase = createClient()

      // Only notes support starring currently
      if (eventType !== 'note') {
        throw new Error('Only notes can be starred')
      }

      // Get current starred status
      const { data: note } = await supabase
        .from('work_item_notes')
        .select('starred')
        .eq('id', eventId)
        .single()

      const newStarred = !note?.starred

      const { error } = await supabase
        .from('work_item_notes')
        .update({ starred: newStarred })
        .eq('id', eventId)

      if (error) throw error

      return { eventId, starred: newStarred }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
      queryClient.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}
