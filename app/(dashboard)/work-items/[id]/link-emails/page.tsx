'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Mail, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useWorkItem } from '@/lib/hooks/use-work-items'
import { formatDistanceToNow } from 'date-fns'

export default function LinkEmailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()
  const { data: workItem, isLoading: workItemLoading } = useWorkItem(id)

  // Fetch all unlinked communications for this customer email
  const { data: unlinkedEmails, isLoading: emailsLoading } = useQuery({
    queryKey: ['unlinked-emails', workItem?.customer_email],
    queryFn: async () => {
      if (!workItem?.customer_email) return []

      const { data, error } = await supabase
        .from('communications')
        .select('*')
        .or(`from_email.eq.${workItem.customer_email},to_emails.cs.{${workItem.customer_email}}`)
        .is('work_item_id', null)
        .order('received_at', { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!workItem?.customer_email,
  })

  // Mutation to link an email to this work item
  const linkEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { data, error } = await supabase
        .from('communications')
        .update({
          work_item_id: id,
          triage_status: 'attached'
        })
        .eq('id', emailId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      toast.success('Email linked successfully')
      queryClient.invalidateQueries({ queryKey: ['unlinked-emails'] })
      queryClient.invalidateQueries({ queryKey: ['communications', id] })
      queryClient.invalidateQueries({ queryKey: ['timeline', id] })
    },
    onError: () => {
      toast.error('Failed to link email')
    },
  })

  if (workItemLoading || emailsLoading) {
    return (
      <div className="p-6">
        <p>Loading...</p>
      </div>
    )
  }

  if (!workItem) {
    return (
      <div className="p-6">
        <p>Work item not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/work-items/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <div className="flex-1">
          <h1 className="text-3xl font-bold">Link Emails</h1>
          <p className="text-muted-foreground">
            Find and link emails from {workItem.customer_email} to this work item
          </p>
        </div>
      </div>

      {/* Unlinked Emails */}
      <Card>
        <CardHeader>
          <CardTitle>Unlinked Emails from {workItem.customer_email}</CardTitle>
        </CardHeader>
        <CardContent>
          {!unlinkedEmails || unlinkedEmails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No unlinked emails found</p>
              <p className="text-sm text-muted-foreground">
                All emails from this customer are already linked to work items
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {unlinkedEmails.map((email) => (
                <Card key={email.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {email.subject || '(no subject)'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {email.direction === 'inbound'
                            ? `From: ${email.from_email}`
                            : `To: ${email.to_emails.join(', ')}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {email.received_at && formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                        </p>
                        {email.body_preview && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {email.body_preview}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => linkEmailMutation.mutate(email.id)}
                        disabled={linkEmailMutation.isPending}
                        className="gap-2"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Link to Work Item
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => router.push(`/work-items/${id}`)}>
          Done
        </Button>
      </div>
    </div>
  )
}
