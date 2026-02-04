'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  useEmailsByCategory,
  useEmailCategoryCounts,
  useTriageEmail,
  useSendEmail,
  useEmailThread,
  useMarkEmailAsRead,
  useMoveEmailToCategory,
} from '@/lib/hooks/use-communications'
import { useCreateWorkItem, useWorkItem } from '@/lib/hooks/use-work-items'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Mail,
  User,
  ChevronDown,
  ChevronUp,
  Reply,
  Archive,
  Flag,
  FileText,
  Code,
  Search,
  MoreVertical,
  Inbox,
  Tag,
  AlertCircle,
  Bell,
  Filter,
  Download,
  Check,
  Paperclip,
  ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import DOMPurify from 'dompurify'
import { toast } from 'sonner'
import { parseEmailAddress, extractEmailPreview } from '@/lib/utils/email-formatting'

type EmailCategory = 'primary' | 'promotional' | 'spam' | 'notifications'

type Email = {
  id: string
  from_email: string
  to_emails: string[]
  subject: string | null
  body_preview: string | null
  body_html: string | null
  received_at: string | null
  provider_thread_id: string | null
  has_attachments: boolean
  category: EmailCategory
  is_read: boolean
  triage_status: string
  work_item_id: string | null
}

// Component to show linked work item badge
function LinkedWorkItemBadge({ workItemId }: { workItemId: string | null }) {
  const { data: workItem } = useWorkItem(workItemId || '')

  if (!workItemId || !workItem) return null

  return (
    <Link href={`/work-items/${workItemId}`}>
      <Badge
        variant="outline"
        className="gap-1 hover:bg-[#9C27B0]/10 hover:border-[#9C27B0] transition-colors cursor-pointer"
      >
        <Paperclip className="h-3 w-3" />
        {workItem.shopify_order_number || `Order #${workItem.id.slice(0, 8)}`}
        <ExternalLink className="h-3 w-3" />
      </Badge>
    </Link>
  )
}

export default function EmailIntakePage() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState<EmailCategory>('primary')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'html' | 'text'>('text')

  // UI state
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false)
  const [showEmailDetailSheet, setShowEmailDetailSheet] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importLimit, setImportLimit] = useState(100)
  const [importDays, setImportDays] = useState(60)
  const [replyText, setReplyText] = useState('')
  const [showReplyForm, setShowReplyForm] = useState(false)

  // Hooks
  const { data: emails, isLoading, refetch } = useEmailsByCategory(activeCategory, 'untriaged')
  const { data: categoryCounts } = useEmailCategoryCounts('untriaged')
  const triageEmail = useTriageEmail()
  const createWorkItem = useCreateWorkItem()
  const sendEmail = useSendEmail()
  const markAsRead = useMarkEmailAsRead()
  const moveToCategory = useMoveEmailToCategory()
  const { data: threadEmails } = useEmailThread(selectedEmail?.provider_thread_id || null)

  const [leadForm, setLeadForm] = useState({
    customerName: '',
    customerEmail: '',
    title: '',
    eventDate: '',
    notes: '',
  })

  // Filter emails by search query
  const filteredEmails = useMemo(() => {
    if (!emails) return []
    if (!searchQuery.trim()) return emails

    const query = searchQuery.toLowerCase()
    return emails.filter(
      (email) =>
        email.from_email.toLowerCase().includes(query) ||
        email.subject?.toLowerCase().includes(query) ||
        email.body_preview?.toLowerCase().includes(query)
    )
  }, [emails, searchQuery])

  // Group emails by sender
  const emailGroups = useMemo(() => {
    const groups = new Map<string, Email[]>()

    filteredEmails.forEach((email) => {
      const key = email.from_email
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(email)
    })

    return Array.from(groups.entries())
      .map(([sender, emails]) => ({
        sender,
        emails: emails.sort(
          (a, b) => new Date(b.received_at || 0).getTime() - new Date(a.received_at || 0).getTime()
        ),
        latestEmail: emails[0],
        count: emails.length,
        hasUnread: emails.some((e) => !e.is_read),
      }))
      .sort(
        (a, b) =>
          new Date(b.latestEmail.received_at || 0).getTime() -
          new Date(a.latestEmail.received_at || 0).getTime()
      )
  }, [filteredEmails])

  // Bulk actions
  const toggleEmailSelection = (emailId: string) => {
    const newSelection = new Set(selectedEmails)
    if (newSelection.has(emailId)) {
      newSelection.delete(emailId)
    } else {
      newSelection.add(emailId)
    }
    setSelectedEmails(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set())
    } else {
      setSelectedEmails(new Set(filteredEmails.map((e) => e.id)))
    }
  }

  const handleBulkArchive = async () => {
    const promises = Array.from(selectedEmails).map((id) =>
      triageEmail.mutateAsync({ id, triageStatus: 'archived' })
    )
    await Promise.all(promises)
    setSelectedEmails(new Set())
    toast.success(`Archived ${promises.length} email(s)`)
  }

  const handleBulkMoveToCategory = async (category: EmailCategory) => {
    const promises = Array.from(selectedEmails).map((id) => {
      const email = filteredEmails.find((e) => e.id === id)
      return moveToCategory.mutateAsync({
        emailId: id,
        category,
        createFilter: true,
        fromEmail: email?.from_email,
      })
    })
    await Promise.all(promises)
    setSelectedEmails(new Set())
    toast.success(`Moved ${promises.length} email(s) to ${category}`)
  }

  // Email actions
  const handleCreateLead = async () => {
    if (!selectedEmail) return

    const { data: workItem } = await createWorkItem.mutateAsync({
      type: 'assisted_project',
      source: 'email',
      status: 'new_inquiry',
      customer_name: leadForm.customerName,
      customer_email: leadForm.customerEmail,
      title: leadForm.title || `Inquiry from ${leadForm.customerName}`,
      event_date: leadForm.eventDate || null,
      last_contact_at: selectedEmail.received_at,
      next_follow_up_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })

    await triageEmail.mutateAsync({
      id: selectedEmail.id,
      triageStatus: 'created_lead',
      workItemId: workItem?.id,
    })

    setShowCreateLeadDialog(false)
    setSelectedEmail(null)
    setLeadForm({
      customerName: '',
      customerEmail: '',
      title: '',
      eventDate: '',
      notes: '',
    })
    toast.success('Lead created successfully')

    // Navigate to the work item page
    if (workItem?.id) {
      router.push(`/work-items/${workItem.id}`)
    }
  }

  const handleArchive = async (emailId: string) => {
    await triageEmail.mutateAsync({ id: emailId, triageStatus: 'archived' })
    toast.success('Email archived')
  }

  const handleFlagSupport = async (emailId: string) => {
    await triageEmail.mutateAsync({ id: emailId, triageStatus: 'flagged_support' })
    toast.success('Email flagged for support')
  }

  const handleMoveToCategory = async (emailId: string, category: EmailCategory, createFilter: boolean) => {
    const email = filteredEmails.find((e) => e.id === emailId)
    await moveToCategory.mutateAsync({
      emailId,
      category,
      createFilter,
      fromEmail: email?.from_email,
    })
    toast.success(
      createFilter
        ? `Moved to ${category} and created filter rule`
        : `Moved to ${category}`
    )
  }

  const handleReply = async () => {
    if (!selectedEmail || !replyText.trim()) return

    await sendEmail.mutateAsync({
      workItemId: selectedEmail.work_item_id || '',
      to: selectedEmail.from_email,
      subject: `Re: ${selectedEmail.subject || ''}`,
      body: replyText,
    })

    setReplyText('')
    setShowReplyForm(false)
    setShowEmailDetailSheet(false)
    toast.success('Reply sent')
  }

  const openCreateLeadDialog = (email: Email) => {
    setSelectedEmail(email)
    setLeadForm({
      customerName: email.from_email.split('@')[0] || '',
      customerEmail: email.from_email,
      title: email.subject || '',
      eventDate: '',
      notes: email.body_preview || '',
    })
    setShowCreateLeadDialog(true)
  }

  const openEmailDetail = async (email: Email) => {
    setSelectedEmail(email)
    setShowReplyForm(false)
    setReplyText('')
    setShowEmailDetailSheet(true)

    // Mark as read
    if (!email.is_read) {
      await markAsRead.mutateAsync({ id: email.id, isRead: true })
    }
  }

  const toggleGroup = (sender: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(sender)) {
      newExpanded.delete(sender)
    } else {
      newExpanded.add(sender)
    }
    setExpandedGroups(newExpanded)
  }

  const handleImportEmails = async () => {
    setIsImporting(true)
    try {
      const response = await fetch('/api/email/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: importLimit, daysBack: importDays }),
      })

      const result = await response.json()

      if (response.ok) {
        const message = `Imported ${result.imported} new emails${result.skipped > 0 ? `, skipped ${result.skipped} duplicates` : ''}${result.filtered > 0 ? `, filtered ${result.filtered} junk emails` : ''}`
        toast.success(message)
        setShowImportDialog(false)
        refetch()
      } else {
        toast.error(`Failed to import emails: ${result.error}`)
      }
    } catch (error) {
      toast.error('Failed to import emails')
    } finally {
      setIsImporting(false)
    }
  }

  const getCategoryIcon = (category: EmailCategory) => {
    switch (category) {
      case 'primary':
        return <Inbox className="h-4 w-4" />
      case 'promotional':
        return <Tag className="h-4 w-4" />
      case 'spam':
        return <AlertCircle className="h-4 w-4" />
      case 'notifications':
        return <Bell className="h-4 w-4" />
    }
  }

  const getCategoryLabel = (category: EmailCategory) => {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading emails...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Email Inbox</h1>
          <p className="text-muted-foreground">Manage your customer emails</p>
        </div>
        <Button onClick={() => setShowImportDialog(true)} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Import Emails
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails by sender, subject, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {selectedEmails.size > 0 && (
          <div className="flex gap-2">
            <Badge variant="secondary" className="px-3 py-2">
              {selectedEmails.size} selected
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Filter className="h-4 w-4" />
                  Bulk Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                <DropdownMenuItem onClick={handleBulkArchive}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Selected
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleBulkMoveToCategory('primary')}>
                  Move to Primary
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkMoveToCategory('promotional')}>
                  Move to Promotional
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkMoveToCategory('spam')}>
                  Move to Spam
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkMoveToCategory('notifications')}>
                  Move to Notifications
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as EmailCategory)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="primary" className="gap-2">
            {getCategoryIcon('primary')}
            Primary
            {(categoryCounts?.primary || 0) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {categoryCounts?.primary || 0}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="promotional" className="gap-2">
            {getCategoryIcon('promotional')}
            Promotional
            {(categoryCounts?.promotional || 0) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {categoryCounts?.promotional || 0}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="spam" className="gap-2">
            {getCategoryIcon('spam')}
            Spam
            {(categoryCounts?.spam || 0) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {categoryCounts?.spam || 0}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            {getCategoryIcon('notifications')}
            Notifications
            {(categoryCounts?.notifications || 0) > 0 && (
              <Badge variant="secondary" className="ml-1">
                {categoryCounts?.notifications || 0}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6 space-y-3">
          {/* Select All Checkbox */}
          {filteredEmails.length > 0 && (
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                checked={selectedEmails.size === filteredEmails.length && filteredEmails.length > 0}
                onCheckedChange={toggleSelectAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                Select all {filteredEmails.length} email(s)
              </label>
            </div>
          )}

          {!filteredEmails || filteredEmails.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  {searchQuery ? 'No emails match your search' : `No ${activeCategory} emails`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'Try a different search term' : 'All caught up!'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {emailGroups.map((group) => (
                <Card
                  key={group.sender}
                  className={`hover:shadow-lg transition-all ${
                    group.hasUnread ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      {/* Selection Checkbox */}
                      <Checkbox
                        checked={group.emails.every((e) => selectedEmails.has(e.id))}
                        onCheckedChange={() => {
                          const allSelected = group.emails.every((e) => selectedEmails.has(e.id))
                          const newSelection = new Set(selectedEmails)
                          group.emails.forEach((e) => {
                            if (allSelected) {
                              newSelection.delete(e.id)
                            } else {
                              newSelection.add(e.id)
                            }
                          })
                          setSelectedEmails(newSelection)
                        }}
                        className="mt-1"
                      />

                      {/* Sender Avatar */}
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-[#9C27B0]/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-[#9C27B0]" />
                        </div>
                      </div>

                      {/* Email Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                className={`text-base ${
                                  group.hasUnread ? 'font-bold' : 'font-semibold'
                                }`}
                              >
                                {parseEmailAddress(group.sender).displayName}
                              </p>
                              {group.count > 1 && (
                                <Badge variant="outline" className="text-xs">
                                  {group.count}
                                </Badge>
                              )}
                              {!group.latestEmail.is_read && (
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                              )}
                              <LinkedWorkItemBadge workItemId={group.latestEmail.work_item_id} />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {group.latestEmail.received_at &&
                              formatDistanceToNow(new Date(group.latestEmail.received_at), {
                                addSuffix: true,
                              })}
                          </p>
                        </div>

                        {/* Latest Email Preview */}
                        <div className="cursor-pointer" onClick={() => openEmailDetail(group.latestEmail)}>
                          <p
                            className={`text-base hover:text-[#9C27B0] transition-colors mb-2 ${
                              group.hasUnread ? 'font-semibold' : 'font-medium'
                            }`}
                          >
                            {group.latestEmail.subject || '(no subject)'}
                          </p>
                          <p className="text-sm text-muted-foreground/80 line-clamp-6 leading-relaxed">
                            {extractEmailPreview(
                              group.latestEmail.body_html,
                              group.latestEmail.body_preview,
                              400
                            )}
                          </p>
                        </div>

                        {/* Show older emails if grouped */}
                        {group.count > 1 && (
                          <Collapsible open={expandedGroups.has(group.sender)}>
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 text-xs"
                                onClick={() => toggleGroup(group.sender)}
                              >
                                {expandedGroups.has(group.sender) ? (
                                  <>
                                    <ChevronUp className="h-3 w-3 mr-1" />
                                    Hide older emails
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3 mr-1" />
                                    Show {group.count - 1} older email{group.count - 1 > 1 ? 's' : ''}
                                  </>
                                )}
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-3 mt-3">
                              {group.emails.slice(1).map((email) => (
                                <div
                                  key={email.id}
                                  className="pl-4 py-2 border-l-2 border-muted cursor-pointer hover:border-[#9C27B0] hover:bg-muted/30 transition-all rounded-r"
                                  onClick={() => openEmailDetail(email)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-2 flex-1">
                                      {!email.is_read && <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />}
                                      <div className="flex-1 min-w-0">
                                        <p className={`text-sm ${!email.is_read ? 'font-semibold' : 'font-medium'}`}>
                                          {email.subject || '(no subject)'}
                                        </p>
                                        <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1 leading-relaxed">
                                          {extractEmailPreview(email.body_html, email.body_preview, 200)}
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                                      {email.received_at &&
                                        formatDistanceToNow(new Date(email.received_at), {
                                          addSuffix: true,
                                        })}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 mt-4 pt-3 border-t">
                          <Button size="sm" className="gap-1" onClick={() => openCreateLeadDialog(group.latestEmail)}>
                            <User className="h-3 w-3" />
                            Create Lead
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1"
                            onClick={() => handleFlagSupport(group.latestEmail.id)}
                          >
                            <Flag className="h-3 w-3" />
                            Flag Support
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleArchive(group.latestEmail.id)}
                          >
                            <Archive className="h-3 w-3" />
                          </Button>

                          {/* More Actions Dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                              <DropdownMenuItem
                                onClick={() =>
                                  handleMoveToCategory(group.latestEmail.id, 'primary', true)
                                }
                              >
                                <Inbox className="h-4 w-4 mr-2" />
                                Move to Primary & Create Filter
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleMoveToCategory(group.latestEmail.id, 'promotional', true)
                                }
                              >
                                <Tag className="h-4 w-4 mr-2" />
                                Move to Promotional & Create Filter
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleMoveToCategory(group.latestEmail.id, 'spam', true)
                                }
                              >
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Move to Spam & Create Filter
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleMoveToCategory(group.latestEmail.id, 'notifications', true)
                                }
                              >
                                <Bell className="h-4 w-4 mr-2" />
                                Move to Notifications & Create Filter
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Email Detail Sheet */}
      <Sheet open={showEmailDetailSheet} onOpenChange={setShowEmailDetailSheet}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          {selectedEmail && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <SheetTitle className="mb-0">{selectedEmail.subject || '(no subject)'}</SheetTitle>
                      <LinkedWorkItemBadge workItemId={selectedEmail.work_item_id} />
                    </div>
                    <SheetDescription>
                      Conversation with {parseEmailAddress(selectedEmail.from_email).displayName}
                    </SheetDescription>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button
                      size="sm"
                      variant={viewMode === 'text' ? 'default' : 'outline'}
                      onClick={() => setViewMode('text')}
                      className="gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Text
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === 'html' ? 'default' : 'outline'}
                      onClick={() => setViewMode('html')}
                      className="gap-1"
                    >
                      <Code className="h-3 w-3" />
                      HTML
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Thread of Emails */}
                {threadEmails && threadEmails.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      {threadEmails.length} message{threadEmails.length > 1 ? 's' : ''} in thread
                    </p>
                    {threadEmails.map((email) => (
                      <div
                        key={email.id}
                        className={`border rounded-lg p-4 ${
                          email.direction === 'outbound' ? 'bg-blue-50/50 border-blue-200' : 'bg-background'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                email.direction === 'outbound' ? 'bg-blue-100' : 'bg-purple-100'
                              }`}
                            >
                              <User
                                className={`h-4 w-4 ${
                                  email.direction === 'outbound' ? 'text-blue-600' : 'text-purple-600'
                                }`}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {parseEmailAddress(email.from_email).displayName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {(email.sent_at || email.received_at) &&
                                  formatDistanceToNow(new Date(email.sent_at || email.received_at!), {
                                    addSuffix: true,
                                  })}
                              </p>
                            </div>
                          </div>
                          <Badge variant={email.direction === 'outbound' ? 'default' : 'secondary'}>
                            {email.direction === 'outbound' ? 'Sent' : 'Received'}
                          </Badge>
                        </div>

                        {/* Email Body */}
                        <div className="border-t pt-3">
                          {viewMode === 'html' && email.body_html ? (
                            <div
                              className="email-content prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(email.body_html, {
                                  ALLOWED_TAGS: [
                                    'p',
                                    'br',
                                    'strong',
                                    'em',
                                    'u',
                                    'a',
                                    'ul',
                                    'ol',
                                    'li',
                                    'h1',
                                    'h2',
                                    'h3',
                                    'h4',
                                    'div',
                                    'span',
                                    'table',
                                    'thead',
                                    'tbody',
                                    'tr',
                                    'td',
                                    'th',
                                    'img',
                                    'blockquote',
                                  ],
                                  ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'width', 'height'],
                                }),
                              }}
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {extractEmailPreview(email.body_html, email.body_preview, 1000)}
                            </p>
                          )}
                        </div>

                        {email.has_attachments && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              Has attachments
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {parseEmailAddress(selectedEmail.from_email).displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {selectedEmail.received_at &&
                              formatDistanceToNow(new Date(selectedEmail.received_at), {
                                addSuffix: true,
                              })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">Received</Badge>
                    </div>

                    <div className="border-t pt-3">
                      {viewMode === 'html' && selectedEmail.body_html ? (
                        <div
                          className="email-content prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(selectedEmail.body_html, {
                              ALLOWED_TAGS: [
                                'p',
                                'br',
                                'strong',
                                'em',
                                'u',
                                'a',
                                'ul',
                                'ol',
                                'li',
                                'h1',
                                'h2',
                                'h3',
                                'h4',
                                'div',
                                'span',
                                'table',
                                'thead',
                                'tbody',
                                'tr',
                                'td',
                                'th',
                                'img',
                                'blockquote',
                              ],
                              ALLOWED_ATTR: ['href', 'target', 'src', 'alt', 'width', 'height'],
                            }),
                          }}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {extractEmailPreview(selectedEmail.body_html, selectedEmail.body_preview, 1000)}
                        </p>
                      )}
                    </div>

                    {selectedEmail.has_attachments && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          Has attachments
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="border-t pt-4 space-y-3">
                  {!showReplyForm ? (
                    <div className="flex gap-2">
                      <Button variant="default" className="gap-1 flex-1" onClick={() => setShowReplyForm(true)}>
                        <Reply className="h-4 w-4" />
                        Reply
                      </Button>
                      <Button
                        variant="secondary"
                        className="gap-1 flex-1"
                        onClick={() => {
                          openCreateLeadDialog(selectedEmail)
                          setShowEmailDetailSheet(false)
                        }}
                      >
                        <User className="h-4 w-4" />
                        Create Lead
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium">Reply to {selectedEmail.from_email}</label>
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply..."
                          rows={6}
                          className="mt-2"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleReply} disabled={!replyText.trim() || sendEmail.isPending}>
                          {sendEmail.isPending ? 'Sending...' : 'Send Reply'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowReplyForm(false)
                            setReplyText('')
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => {
                        handleFlagSupport(selectedEmail.id)
                        setShowEmailDetailSheet(false)
                      }}
                    >
                      <Flag className="h-3 w-3" />
                      Flag Support
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        handleArchive(selectedEmail.id)
                        setShowEmailDetailSheet(false)
                      }}
                    >
                      <Archive className="h-3 w-3" />
                      Archive
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Import Emails Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Historical Emails</DialogTitle>
            <DialogDescription>
              Import emails from your mailbox. The system will automatically categorize, skip duplicates, and
              filter out junk emails.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Import from last</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={importDays}
                onChange={(e) => setImportDays(Number(e.target.value))}
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days (Recommended)</option>
                <option value={90}>90 days</option>
                <option value={180}>6 months</option>
                <option value={365}>1 year</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Maximum emails to import</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={importLimit}
                onChange={(e) => setImportLimit(Number(e.target.value))}
              >
                <option value={50}>50 emails</option>
                <option value={100}>100 emails (Recommended)</option>
                <option value={200}>200 emails</option>
                <option value={500}>500 emails</option>
              </select>
            </div>

            <div className="rounded-lg bg-muted p-3 space-y-1">
              <p className="text-sm font-medium">Auto-filtering enabled:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Emails will be automatically categorized (Primary/Promotional/Spam/Notifications)</li>
                <li>• Duplicates will be skipped</li>
                <li>• Junk emails will be filtered</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportEmails} disabled={isImporting}>
              {isImporting ? 'Importing...' : 'Import Emails'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Lead Dialog */}
      <Dialog open={showCreateLeadDialog} onOpenChange={setShowCreateLeadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Assisted Project Lead</DialogTitle>
            <DialogDescription>Create a new lead from this email inquiry</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Name</label>
                <Input
                  value={leadForm.customerName}
                  onChange={(e) => setLeadForm({ ...leadForm, customerName: e.target.value })}
                  placeholder="Alex Smith"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Email</label>
                <Input
                  type="email"
                  value={leadForm.customerEmail}
                  onChange={(e) => setLeadForm({ ...leadForm, customerEmail: e.target.value })}
                  placeholder="alex@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Project Title</label>
              <Input
                value={leadForm.title}
                onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                placeholder="Wedding fans for Alex & Sam"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Event Date (Optional)</label>
              <Input
                type="date"
                value={leadForm.eventDate}
                onChange={(e) => setLeadForm({ ...leadForm, eventDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Initial Notes</label>
              <Textarea
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                placeholder="Initial inquiry details..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateLeadDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLead} disabled={!leadForm.customerName || !leadForm.customerEmail}>
                Create Lead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
