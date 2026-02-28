'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  useCustomerProfile,
  useConversationMessages,
  markConversationAsRead,
  type CustomerConversation,
} from '@/lib/hooks/use-customer-profile'
import {
  User,
  Mail,
  Phone,
  ShoppingBag,
  MessageSquare,
  Calendar,
  DollarSign,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Plus,
  FileText,
  StickyNote,
  MoreVertical,
  Building2,
  UserCircle,
  Tag,
  Bell,
  CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InlineEmailComposer } from '@/components/email/inline-email-composer'
import { StatusBadge } from '@/components/custom/status-badge'
import { AlternativeContactsManager } from '@/components/customers/alternative-contacts-manager'
import { ProjectDetailView } from '@/components/customers/project-detail-view'
import { CustomerActivityFeed } from '@/components/activity/customer-activity-feed'

// Project Card Component with Enhanced Details
function ProjectCard({ project, customerId }: { project: any; customerId: string }) {
  const statusColors: Record<string, string> = {
    new_inquiry: 'bg-blue-100 text-blue-800',
    awaiting_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    in_production: 'bg-purple-100 text-purple-800',
    shipped: 'bg-gray-100 text-gray-800',
  }

  // Fetch project stats (files, notes count)
  const { data: projectStats } = useQuery({
    queryKey: ['project-stats', project.id],
    queryFn: async () => {
      const supabase = createClient()

      // Get file count
      const { count: fileCount } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('work_item_id', project.id)

      // Get note count
      const { count: noteCount } = await supabase
        .from('work_item_notes')
        .select('*', { count: 'exact', head: true })
        .eq('work_item_id', project.id)

      return {
        fileCount: fileCount || 0,
        noteCount: noteCount || 0,
      }
    },
  })

  return (
    <Link href={`/customers/${customerId}?project=${project.id}`}>
      <Card className="hover:shadow-md transition-all duration-150 cursor-pointer border-muted/40">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base line-clamp-1">
                {project.title || 'Untitled Project'}
              </CardTitle>
              <CardDescription className="mt-1">
                {project.shopify_order_number && `Order #${project.shopify_order_number}`}
              </CardDescription>
            </div>
            <StatusBadge status={project.status} />
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Project Type and Event Date */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="capitalize">{project.type?.replace(/_/g, ' ')}</span>
              {project.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(project.event_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Activity Stats */}
          {projectStats && (
            <div className="flex items-center gap-4 text-xs">
              {projectStats.fileCount > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>{projectStats.fileCount} {projectStats.fileCount === 1 ? 'file' : 'files'}</span>
                </div>
              )}
              {projectStats.noteCount > 0 && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <StickyNote className="h-3.5 w-3.5" />
                  <span>{projectStats.noteCount} {projectStats.noteCount === 1 ? 'note' : 'notes'}</span>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

// Conversation Card Component
function ConversationCard({
  conversation,
  onClick,
}: {
  conversation: CustomerConversation
  onClick: () => void
}) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        conversation.has_unread ? 'border-l-4 border-l-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-1 flex items-center gap-2">
              {conversation.has_unread && (
                <div className="h-2 w-2 bg-primary rounded-full shrink-0" />
              )}
              {conversation.subject}
            </CardTitle>
            {conversation.work_item_title && (
              <CardDescription className="mt-1">
                Related to: {conversation.work_item_title}
              </CardDescription>
            )}
          </div>
          <Badge variant="outline">{conversation.message_count} messages</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-muted-foreground">
          <div>
            Last message from {conversation.last_message_from || 'Unknown'}
          </div>
          <div className="text-xs mt-1">
            {formatDistanceToNow(new Date(conversation.last_message_at), {
              addSuffix: true,
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Conversation Detail Component with Inline Composer
function ConversationDetail({
  conversationId,
  customerId,
  customerEmail,
}: {
  conversationId: string
  customerId: string
  customerEmail: string
}) {
  const { data: messages, isLoading } = useConversationMessages(conversationId)
  const [showComposer, setShowComposer] = useState(false)

  if (isLoading) {
    return <div className="p-6">Loading messages...</div>
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{messages?.length || 0} Messages</h3>
        <div className="space-y-4">
          {messages?.map((message) => (
            <Card
              key={message.id}
              className={
                message.direction === 'inbound' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={message.direction === 'inbound' ? 'default' : 'secondary'}
                    >
                      {message.direction === 'inbound' ? 'From Customer' : 'To Customer'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {message.from_email}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(message.received_at), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-medium mb-2">{message.subject}</div>
                <div
                  className="text-sm prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: message.body_preview || message.body_html || '',
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Inline Email Composer */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Reply to Conversation
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Simple composer for customer context - work item context handled separately */}
          <div className="space-y-4">
            <div>
              <Label>To</Label>
              <div className="mt-1 text-sm text-muted-foreground">{customerEmail}</div>
            </div>
            <div>
              <Label>Subject</Label>
              <div className="mt-1 text-sm text-muted-foreground">
                Re: {messages?.[0]?.subject || 'Conversation'}
              </div>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                placeholder="Type your message here..."
                rows={6}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Button>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
              <Button variant="outline">Save Draft</Button>
              <Button variant="ghost">Preview</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Shopify Orders Tab
function ShopifyOrdersTab({ customerId, shopifyCustomerId }: { customerId: string; shopifyCustomerId: string | null }) {
  // TODO: Implement Shopify API integration
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold mb-2">Shopify Orders</h3>
        {shopifyCustomerId ? (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Shopify Customer ID: {shopifyCustomerId}
            </p>
            <p className="text-sm text-muted-foreground">
              Shopify order history integration coming soon
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Shopify account linked
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// Files Tab
function FilesTab({ customerId }: { customerId: string }) {
  const { data: files, isLoading } = useQuery({
    queryKey: ['customer-files', customerId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })

  if (isLoading) {
    return <div className="p-6">Loading files...</div>
  }

  if (!files || files.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-2">No Files Yet</h3>
          <p className="text-sm text-muted-foreground">
            Files uploaded for this customer will appear here
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{files.length} Files</h3>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Upload File
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((file) => (
          <Card key={file.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm line-clamp-1">{file.filename}</CardTitle>
              <CardDescription>
                {file.file_type && (
                  <Badge variant="outline" className="text-xs">
                    {file.file_type}
                  </Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
              </div>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                Download
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Notes Tab (Simple version without @mentions)
function NotesTab({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient()
  const [newNote, setNewNote] = useState('')

  const { data: notes, isLoading } = useQuery({
    queryKey: ['customer-notes', customerId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customer_notes')
        .select('*, users(first_name, last_name, email)')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })

      if (error) {
        // If table doesn't exist yet, return empty array
        console.warn('Customer notes table not found:', error)
        return []
      }
      return data
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customerId,
          note: noteText,
          created_by_user_id: user?.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] })
      setNewNote('')
      toast.success('Note added successfully')
    },
    onError: (error: any) => {
      toast.error(`Failed to add note: ${error.message}`)
    },
  })

  const handleAddNote = () => {
    if (!newNote.trim()) return
    addNoteMutation.mutate(newNote)
  }

  return (
    <div className="space-y-6">
      {/* Add Note */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Add Internal Note
          </CardTitle>
          <CardDescription>
            Notes are private and visible only to your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Textarea
              placeholder="Add a note about this customer..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
            />
            <Button onClick={handleAddNote} disabled={!newNote.trim() || addNoteMutation.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Add Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">
          {notes?.length || 0} {notes?.length === 1 ? 'Note' : 'Notes'}
        </h3>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground">Loading notes...</div>
        ) : !notes || notes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <StickyNote className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Notes Yet</h3>
              <p className="text-sm text-muted-foreground">
                Add internal notes to track important information about this customer
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notes.map((note: any) => (
              <Card key={note.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {note.users?.first_name} {note.users?.last_name}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Main Customer Profile Page
export default function CustomerProfilePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const customerId = params.id as string
  const projectId = searchParams?.get('project')
  const { data: profileData, isLoading } = useCustomerProfile(customerId)

  // Fetch alternative contacts
  const { data: alternativeContacts } = useQuery({
    queryKey: ['customer-alternative-contacts', customerId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!customerId,
  })
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Customer Not Found</h3>
            <p className="text-muted-foreground">
              The customer you're looking for doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { customer, projects, conversations, stats } = profileData

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header - PDR v3 Spec */}
      <div className="space-y-3 sm:space-y-4">
        {/* Back Button */}
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="gap-2 h-10">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Customers</span>
          </Button>
        </Link>

        {/* Customer Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold truncate flex-1">
                {customer.display_name ||
                 (customer.first_name && customer.last_name
                   ? `${customer.first_name} ${customer.last_name}`
                   : customer.first_name || customer.last_name || customer.email)}
              </h1>
              {/* Status Badge */}
              {(customer as any).status && (
                <Badge variant="outline" className="text-xs sm:text-sm flex-shrink-0">
                  {(customer as any).status}
                </Badge>
              )}
            </div>

            {/* Contact Info and Organization */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
              {(customer as any).organization_name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{(customer as any).organization_name}</span>
                </div>
              )}
              {/* Only show email if it's not being used as the name */}
              {(customer.display_name || customer.first_name || customer.last_name) && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <span>{customer.phone}</span>
                </div>
              )}
            </div>

            {/* Assigned To */}
            {(customer as any).assigned_to_user_id && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Assigned to:</span>
                <span className="font-medium">Team Member</span>
              </div>
            )}

            {/* Alternative Contacts */}
            {alternativeContacts && alternativeContacts.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                  Additional Contacts:
                </div>
                <div className="flex flex-wrap gap-2">
                  {alternativeContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm bg-muted/50 px-2.5 sm:px-3 py-1.5 rounded-full"
                    >
                      <User className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate max-w-[120px] sm:max-w-none">{contact.full_name}</span>
                      {contact.role && (
                        <>
                          <span className="text-muted-foreground hidden sm:inline">•</span>
                          <span className="text-muted-foreground hidden sm:inline truncate">{contact.role}</span>
                        </>
                      )}
                      {contact.is_primary && (
                        <Badge variant="secondary" className="text-[10px] sm:text-xs ml-0.5 sm:ml-1">
                          Primary
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-2 h-10 flex-1 sm:flex-none">
              <Mail className="h-4 w-4" />
              <span className="hidden xs:inline">Email Customer</span>
              <span className="xs:hidden">Email</span>
            </Button>
            <Link href={`/work-items/new?customer_id=${customerId}`} className="flex-1 sm:flex-none">
              <Button variant="outline" className="gap-2 h-10 w-full">
                <Plus className="h-4 w-4" />
                <span className="hidden xs:inline">Create Project</span>
                <span className="xs:hidden">Project</span>
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Edit Customer</DropdownMenuItem>
                <DropdownMenuItem>View in Shopify</DropdownMenuItem>
                <DropdownMenuItem>Export Data</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-muted/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_projects}</div>
          </CardContent>
        </Card>
        <Card className="border-muted/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.active_projects}
            </div>
          </CardContent>
        </Card>
        <Card className="border-muted/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_conversations}</div>
            {stats.unread_conversations > 0 && (
              <div className="text-sm text-primary mt-1">
                {stats.unread_conversations} unread
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-muted/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.completed_projects}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area with Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - 2/3 width on desktop */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="projects" className="space-y-4">
            <TabsList className="w-full h-auto flex-wrap justify-start p-1 gap-1">
              <TabsTrigger value="projects" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                <ShoppingBag className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Projects</span>
              </TabsTrigger>
              <TabsTrigger value="contacts" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Contacts</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                <MessageSquare className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Activity</span>
              </TabsTrigger>
              <TabsTrigger value="shopify" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                <ShoppingBag className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Shopify</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Files</span>
              </TabsTrigger>
            </TabsList>

            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-4">
              {projectId ? (
                /* Viewing specific project - keep customer context visible */
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/customers/${customerId}`}>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to All Projects
                      </Button>
                    </Link>
                  </div>
                  <ProjectDetailView
                    projectId={projectId}
                    customerId={customerId}
                    customerName={customer.display_name || customer.email}
                  />
                </div>
              ) : projects.length === 0 ? (
                /* No projects yet */
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      This customer doesn't have any projects.
                    </p>
                    <Link href={`/work-items/new?customer_id=${customerId}`}>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Project
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                /* Project list */
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{projects.length} Projects</h3>
                    <Link href={`/work-items/new?customer_id=${customerId}`}>
                      <Button size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                      </Button>
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {projects.map((project) => (
                      <ProjectCard key={project.id} project={project} customerId={customerId} />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Contacts Tab */}
            <TabsContent value="contacts">
              <AlternativeContactsManager customerId={customerId} />
            </TabsContent>

            {/* Activity Tab - Follow Up Boss Style */}
            <TabsContent value="activity" className="space-y-4">
              <CustomerActivityFeed
                customerId={customerId}
                customerEmail={customer.email}
              />
            </TabsContent>

            {/* Old Emails Tab - Remove after testing */}
            <TabsContent value="emails-old" className="space-y-4">
              {selectedConversationId ? (
                <div>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedConversationId(null)}
                    className="mb-4"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Conversations
                  </Button>
                  <ConversationDetail
                    conversationId={selectedConversationId}
                    customerId={customerId}
                    customerEmail={customer.email}
                  />
                </div>
              ) : conversations.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Conversations Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      This customer hasn't had any email conversations.
                    </p>
                    <Button>
                      <Mail className="mr-2 h-4 w-4" />
                      Send First Email
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{conversations.length} Conversations</h3>
                    <Button size="sm">
                      <Mail className="mr-2 h-4 w-4" />
                      New Email
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {conversations.map((conversation) => (
                      <ConversationCard
                        key={conversation.conversation_id}
                        conversation={conversation}
                        onClick={() => {
                          setSelectedConversationId(conversation.conversation_id)
                          if (conversation.has_unread) {
                            markConversationAsRead(conversation.conversation_id)
                          }
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Shopify Orders Tab */}
            <TabsContent value="shopify">
              <ShopifyOrdersTab
                customerId={customerId}
                shopifyCustomerId={customer.shopify_customer_id}
              />
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files">
              <FilesTab customerId={customerId} />
            </TabsContent>

            {/* Notes Tab - Now part of Activity tab */}
          </Tabs>
        </div>

        {/* Right Sidebar - 1/3 width on desktop */}
        <div className="lg:col-span-1 space-y-4">
          {/* Quick Info */}
          <Card className="border-muted/40">
            <CardHeader>
              <CardTitle className="text-base">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">Customer Since</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(customer.created_at), 'MMM d, yyyy')}
                </div>
              </div>

              {(customer as any).next_follow_up_date && (
                <div>
                  <div className="text-sm font-medium mb-1 flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5" />
                    Next Follow-Up
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(new Date((customer as any).next_follow_up_date), 'MMM d, yyyy')}
                  </div>
                </div>
              )}

              {(customer as any).tags && (customer as any).tags.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5" />
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(customer as any).tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(customer as any).source && (
                <div>
                  <div className="text-sm font-medium mb-1">Lead Source</div>
                  <div className="text-sm text-muted-foreground capitalize">
                    {(customer as any).source.replace(/_/g, ' ')}
                  </div>
                </div>
              )}

              {customer.shopify_customer_id && (
                <div>
                  <div className="text-sm font-medium mb-1">Shopify</div>
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Linked
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revenue Stats (if available) */}
          <Card className="border-muted/40">
            <CardHeader>
              <CardTitle className="text-base">Revenue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Projects</div>
                <div className="text-2xl font-bold">{stats.total_projects}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Lifetime Value</div>
                <div className="text-2xl font-bold text-green-600">
                  <DollarSign className="inline h-5 w-5" />
                  {/* TODO: Calculate from Shopify orders */}
                  ---
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
