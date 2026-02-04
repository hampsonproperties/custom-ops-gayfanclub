'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Link as LinkIcon, Mail } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'

type Email = {
  id: string
  from_email: string
  subject: string | null
  body_preview: string | null
  received_at: string | null
  triage_status: string
  work_item_id: string | null
}

export default function LinkEmailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [emails, setEmails] = useState<Email[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLinking, setIsLinking] = useState<string | null>(null)

  useEffect(() => {
    fetchEmails()
  }, [])

  const fetchEmails = async () => {
    try {
      const response = await fetch('/api/email/recent-unlinked')
      const data = await response.json()
      setEmails(data.emails || [])
    } catch (error) {
      toast.error('Failed to load emails')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkEmail = async (emailId: string) => {
    setIsLinking(emailId)
    try {
      const response = await fetch(`/api/work-items/${id}/link-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      })

      if (!response.ok) throw new Error('Failed to link')

      toast.success('Email linked successfully')
      router.push(`/work-items/${id}`)
    } catch (error) {
      toast.error('Failed to link email')
      setIsLinking(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/work-items/${id}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>

        <div className="flex-1">
          <h1 className="text-3xl font-bold">Find & Link Email</h1>
          <p className="text-muted-foreground">
            Select the email you want to link to this work item
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Emails (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading emails...
            </p>
          ) : emails.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No emails found
            </p>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {email.from_email}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {email.triage_status}
                        </Badge>
                        {email.work_item_id && (
                          <Badge variant="secondary" className="text-xs">
                            Already Linked
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium mb-1">
                        {email.subject || '(No subject)'}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {email.body_preview || '(No preview)'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {email.received_at
                          ? formatDistanceToNow(new Date(email.received_at), {
                              addSuffix: true,
                            })
                          : 'Unknown date'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleLinkEmail(email.id)}
                      disabled={isLinking === email.id || !!email.work_item_id}
                      className="gap-2 flex-shrink-0"
                    >
                      <LinkIcon className="h-3 w-3" />
                      {isLinking === email.id ? 'Linking...' : email.work_item_id ? 'Already Linked' : 'Link This Email'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
