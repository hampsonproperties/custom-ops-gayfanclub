'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMyInbox, useReassignEmail, useUpdateEmailPriority } from '@/lib/hooks/use-communications'
import { useActiveUsers } from '@/lib/hooks/use-users'
import { Mail, Inbox, Search, Clock, AlertCircle, CheckCircle2, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import Link from 'next/link'

type PriorityLevel = 'high' | 'medium' | 'low'
type EmailStatus = 'needs_reply' | 'waiting_on_customer' | 'closed'

export default function MyInboxPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmail, setSelectedEmail] = useState<any>(null)
  const [showReassignDialog, setShowReassignDialog] = useState(false)
  const [newOwnerId, setNewOwnerId] = useState<string>('')

  const { data: emails, isLoading } = useMyInbox()
  const { data: users } = useActiveUsers()
  const reassignEmail = useReassignEmail()
  const updateEmailPriority = useUpdateEmailPriority()

  // Filter emails by search query
  const filteredEmails = useMemo(() => {
    if (!emails) return []
    if (!searchQuery.trim()) return emails

    const query = searchQuery.toLowerCase()
    return emails.filter(
      (email) =>
        email.from_email.toLowerCase().includes(query) ||
        email.subject?.toLowerCase().includes(query) ||
        email.body_preview?.toLowerCase().includes(query) ||
        email.work_items?.customer_name?.toLowerCase().includes(query)
    )
  }, [emails, searchQuery])

  // Group emails by priority
  const groupedEmails = useMemo(() => {
    const groups = {
      high: filteredEmails.filter((e) => e.priority === 'high'),
      medium: filteredEmails.filter((e) => e.priority === 'medium'),
      low: filteredEmails.filter((e) => e.priority === 'low'),
    }
    return groups
  }, [filteredEmails])

  const handleReassign = async () => {
    if (!selectedEmail || !newOwnerId) return

    try {
      await reassignEmail.mutateAsync({
        emailId: selectedEmail.id,
        newOwnerId,
      })
      toast.success('Email reassigned successfully')
      setShowReassignDialog(false)
      setSelectedEmail(null)
      setNewOwnerId('')
    } catch (error) {
      toast.error('Failed to reassign email')
    }
  }

  const handleUpdateStatus = async (emailId: string, emailStatus: EmailStatus) => {
    try {
      await updateEmailPriority.mutateAsync({
        emailId,
        emailStatus,
      })
      toast.success('Status updated')
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const getPriorityBadge = (priority: PriorityLevel) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500 text-white">High Priority</Badge>
      case 'medium':
        return <Badge className="bg-yellow-500 text-white">Medium Priority</Badge>
      case 'low':
        return <Badge className="bg-green-500 text-white">Low Priority</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs_reply':
        return <Badge variant="destructive">Needs Reply</Badge>
      case 'waiting_on_customer':
        return <Badge variant="secondary">Waiting on Customer</Badge>
      case 'closed':
        return <Badge variant="outline">Closed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getTimeSinceColor = (receivedAt: string | null) => {
    if (!receivedAt) return 'text-muted-foreground'

    const hoursSince = (Date.now() - new Date(receivedAt).getTime()) / (1000 * 60 * 60)
    if (hoursSince > 48) return 'text-red-600 font-semibold'
    if (hoursSince > 24) return 'text-yellow-600 font-semibold'
    return 'text-green-600'
  }

  const openReassignDialog = (email: any) => {
    setSelectedEmail(email)
    setShowReassignDialog(true)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground">Loading your inbox...</div>
      </div>
    )
  }

  const totalEmails = filteredEmails.length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Inbox className="h-8 w-8" />
          My Priority Inbox
        </h1>
        <p className="text-muted-foreground">
          Emails you own, sorted by priority
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search your emails..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm text-muted-foreground">Total</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEmails}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              High Priority
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{groupedEmails.high.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-yellow-500" />
              Medium Priority
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{groupedEmails.medium.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Low Priority
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{groupedEmails.low.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* High Priority Emails */}
      {groupedEmails.high.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            High Priority ({groupedEmails.high.length})
          </h2>
          {groupedEmails.high.map((email) => (
            <Card key={email.id} className="border-2 border-red-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <EmailCard
                  email={email}
                  onReassign={openReassignDialog}
                  onUpdateStatus={handleUpdateStatus}
                  getPriorityBadge={getPriorityBadge}
                  getStatusBadge={getStatusBadge}
                  getTimeSinceColor={getTimeSinceColor}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Medium Priority Emails */}
      {groupedEmails.medium.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Medium Priority ({groupedEmails.medium.length})
          </h2>
          {groupedEmails.medium.map((email) => (
            <Card key={email.id} className="border border-yellow-200 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <EmailCard
                  email={email}
                  onReassign={openReassignDialog}
                  onUpdateStatus={handleUpdateStatus}
                  getPriorityBadge={getPriorityBadge}
                  getStatusBadge={getStatusBadge}
                  getTimeSinceColor={getTimeSinceColor}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Low Priority Emails */}
      {groupedEmails.low.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Low Priority ({groupedEmails.low.length})
          </h2>
          {groupedEmails.low.map((email) => (
            <Card key={email.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-6">
                <EmailCard
                  email={email}
                  onReassign={openReassignDialog}
                  onUpdateStatus={handleUpdateStatus}
                  getPriorityBadge={getPriorityBadge}
                  getStatusBadge={getStatusBadge}
                  getTimeSinceColor={getTimeSinceColor}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {totalEmails === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-600 opacity-50" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? 'No emails match your search' : 'Inbox Zero!'}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'You have no emails to handle right now'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Reassign Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={setShowReassignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Email</DialogTitle>
            <DialogDescription>
              Transfer ownership of this email to another team member
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedEmail && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-1">{selectedEmail.subject}</div>
                <div className="text-sm text-muted-foreground">
                  From: {selectedEmail.from_email}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Assign to:</label>
              <Select value={newOwnerId} onValueChange={setNewOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowReassignDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReassign}
                disabled={!newOwnerId || reassignEmail.isPending}
              >
                {reassignEmail.isPending ? 'Reassigning...' : 'Reassign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Email Card Component
function EmailCard({
  email,
  onReassign,
  onUpdateStatus,
  getPriorityBadge,
  getStatusBadge,
  getTimeSinceColor,
}: {
  email: any
  onReassign: (email: any) => void
  onUpdateStatus: (emailId: string, status: EmailStatus) => void
  getPriorityBadge: (priority: PriorityLevel) => React.ReactElement
  getStatusBadge: (status: string) => React.ReactElement
  getTimeSinceColor: (receivedAt: string | null) => string
}) {
  return (
    <div className="space-y-4">
      {/* Email Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {getPriorityBadge(email.priority as PriorityLevel)}
            {getStatusBadge(email.email_status)}
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {email.work_items?.customer_name || email.from_email}
            </span>
          </div>
          <div className="text-lg font-semibold mb-1">{email.subject}</div>
          <div className={`text-sm ${getTimeSinceColor(email.received_at)}`}>
            {email.received_at
              ? formatDistanceToNow(new Date(email.received_at), { addSuffix: true })
              : 'No date'}
          </div>
        </div>
      </div>

      {/* Email Preview */}
      <div className="text-sm text-muted-foreground line-clamp-2">
        {email.body_preview}
      </div>

      {/* Linked Work Item */}
      {email.work_items && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="outline">
            {email.work_items.title || `Work Item #${email.work_items.id.slice(0, 8)}`}
          </Badge>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        {email.work_items && (
          <Link href={`/work-items/${email.work_items.id}`}>
            <Button variant="default" size="sm">
              View Work Item
            </Button>
          </Link>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onReassign(email)}
          className="gap-2"
        >
          <User className="h-4 w-4" />
          Reassign
        </Button>
        {email.email_status === 'needs_reply' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateStatus(email.id, 'waiting_on_customer')}
          >
            Mark Waiting
          </Button>
        )}
        {email.email_status !== 'closed' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUpdateStatus(email.id, 'closed')}
          >
            Close
          </Button>
        )}
      </div>
    </div>
  )
}
