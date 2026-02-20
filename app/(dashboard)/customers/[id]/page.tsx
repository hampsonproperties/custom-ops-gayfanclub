'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

function ProjectCard({ project }: { project: any }) {
  const statusColors: Record<string, string> = {
    new_inquiry: 'bg-blue-100 text-blue-800',
    awaiting_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    in_production: 'bg-purple-100 text-purple-800',
    shipped: 'bg-gray-100 text-gray-800',
  }

  return (
    <Link href={`/work-items/${project.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base line-clamp-1">
                {project.title || 'Untitled Project'}
              </CardTitle>
              <CardDescription className="mt-1">
                {project.shopify_order_number && `Order #${project.shopify_order_number}`}
              </CardDescription>
            </div>
            <Badge className={statusColors[project.status] || 'bg-gray-100'}>
              {project.status.replace(/_/g, ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="capitalize">{project.type.replace(/_/g, ' ')}</span>
              {project.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(project.event_date).toLocaleDateString()}
                </span>
              )}
            </div>
            <ArrowRight className="h-4 w-4" />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

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
        conversation.has_unread ? 'border-l-4 border-l-blue-500' : ''
      }`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-1 flex items-center gap-2">
              {conversation.has_unread && (
                <div className="h-2 w-2 bg-blue-500 rounded-full shrink-0" />
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

function ConversationDetail({ conversationId }: { conversationId: string }) {
  const { data: messages, isLoading } = useConversationMessages(conversationId)

  if (isLoading) {
    return <div className="p-6">Loading messages...</div>
  }

  return (
    <div className="space-y-4 p-6">
      <h3 className="text-lg font-semibold">{messages?.length || 0} Messages</h3>
      <div className="space-y-4">
        {messages?.map((message) => (
          <Card
            key={message.id}
            className={
              message.direction === 'inbound' ? 'bg-blue-50' : 'bg-gray-50'
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
  )
}

export default function CustomerProfilePage() {
  const params = useParams()
  const customerId = params.id as string
  const { data: profileData, isLoading } = useCustomerProfile(customerId)
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          {customer.display_name || customer.email}
        </h1>
        <p className="text-muted-foreground">Customer Profile</p>
      </div>

      {/* Customer Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Email</div>
                <div className="text-sm text-muted-foreground">{customer.email}</div>
              </div>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Phone</div>
                  <div className="text-sm text-muted-foreground">{customer.phone}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Customer Since</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(customer.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            {customer.shopify_customer_id && (
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Shopify Customer ID</div>
                  <div className="text-sm text-muted-foreground">
                    {customer.shopify_customer_id}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_projects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {stats.active_projects}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total_conversations}</div>
            {stats.unread_conversations > 0 && (
              <div className="text-sm text-blue-600 mt-1">
                {stats.unread_conversations} unread
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats.completed_projects}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Projects and Conversations */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Projects ({projects.length})
          </TabsTrigger>
          <TabsTrigger value="conversations" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversations ({conversations.length})
            {stats.unread_conversations > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.unread_conversations}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          {projects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                <p className="text-muted-foreground">
                  This customer doesn't have any projects.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          {selectedConversationId ? (
            <div>
              <Button
                variant="outline"
                onClick={() => setSelectedConversationId(null)}
                className="mb-4"
              >
                ← Back to Conversations
              </Button>
              <ConversationDetail conversationId={selectedConversationId} />
            </div>
          ) : conversations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Conversations Yet</h3>
                <p className="text-muted-foreground">
                  This customer hasn't had any email conversations.
                </p>
              </CardContent>
            </Card>
          ) : (
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
