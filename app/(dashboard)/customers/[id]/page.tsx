'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  useCustomerProfile,
} from '@/lib/hooks/use-customer-profile'
import { logger } from '@/lib/logger'
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
  Plus,
  FileText,
  StickyNote,
  Building2,
  UserCircle,
  Tag,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  MapPin,
  Globe,
  Package,
  Edit,
  Save,
  Lock,
  Loader2,
  PackageCheck,
  RotateCcw,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, format } from 'date-fns'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { EmailComposer } from '@/components/email/email-composer'
import { StatusBadge } from '@/components/custom/status-badge'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { AlternativeContactsManager } from '@/components/customers/alternative-contacts-manager'
import { CustomerActivityFeed } from '@/components/activity/customer-activity-feed'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { ShopifyOrdersTab } from '@/components/shopify/shopify-orders-tab'
import { useAllUsers } from '@/lib/hooks/use-users'
import { SummaryPanel } from '@/components/ai/summary-panel'
import { useRetailAccount, useUpdateRetailAccount } from '@/lib/hooks/use-retail-accounts'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const log = logger('customer-detail')

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
    <Link href={`/work-items/${project.id}`}>
      <Card className={`hover:shadow-md transition-all duration-150 cursor-pointer border-muted/40 ${project.closed_at ? 'opacity-60' : ''}`}>
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
// Shopify Orders Tab is now imported from @/components/shopify/shopify-orders-tab

// Files Tab
function FilesTab({ customerId }: { customerId: string }) {
  const { data: files, isLoading } = useQuery({
    queryKey: ['customer-files', customerId],
    queryFn: async () => {
      const supabase = createClient()

      // First, get all project IDs for this customer
      const { data: projects, error: projectsError } = await supabase
        .from('work_items')
        .select('id')
        .eq('customer_id', customerId)

      if (projectsError) throw projectsError

      const projectIds = projects?.map(p => p.id) || []

      // If no projects, return empty array
      if (projectIds.length === 0) {
        return []
      }

      // Get all files from these projects, with project info
      const { data, error } = await supabase
        .from('files')
        .select(`
          *,
          work_item:work_items(id, title, shopify_order_number, status)
        `)
        .in('work_item_id', projectIds)
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
        <p className="text-xs text-muted-foreground">Upload files from individual project pages</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {files.map((file: any) => (
          <Card key={file.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm line-clamp-1">{file.original_filename}</CardTitle>
              <CardDescription className="space-y-1">
                {file.work_item && (
                  <div className="text-xs text-muted-foreground">
                    Project: {file.work_item.title || `Order #${file.work_item.shopify_order_number}` || 'Untitled'}
                  </div>
                )}
                {file.file_type && (
                  <Badge variant="outline" className="text-xs">
                    {file.file_type}
                  </Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-2">
                Uploaded {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/files/${file.id}/download`)
                    const data = await response.json()
                    if (data.url) {
                      window.open(data.url, '_blank')
                    }
                  } catch (error) {
                    log.error('Download error', { error })
                    toast.error('Failed to download file')
                  }
                }}
              >
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
        log.warn('Customer notes table not found', { error })
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

// B2B Account Tab — shows retail account details for retailer/org customers
function B2BAccountTab({ retailAccountId }: { retailAccountId: string }) {
  const { data: account, isLoading } = useRetailAccount(retailAccountId)
  const updateAccount = useUpdateRetailAccount()
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    account_name: '', account_type: 'retailer', primary_contact_name: '',
    primary_contact_email: '', primary_contact_phone: '', billing_email: '',
    business_address: '', city: '', state: '', zip_code: '', website_url: '',
    tax_id: '', credit_limit: '', payment_terms: '', industry: '', internal_notes: '',
  })
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  useEffect(() => {
    if (account && editOpen) {
      setEditForm({
        account_name: account.account_name || '', account_type: account.account_type || 'retailer',
        primary_contact_name: account.primary_contact_name || '',
        primary_contact_email: account.primary_contact_email || '',
        primary_contact_phone: account.primary_contact_phone || '',
        billing_email: account.billing_email || '', business_address: account.business_address || '',
        city: account.city || '', state: account.state || '', zip_code: account.zip_code || '',
        website_url: account.website_url || '', tax_id: account.tax_id || '',
        credit_limit: account.credit_limit ? String(account.credit_limit) : '',
        payment_terms: account.payment_terms || '', industry: account.industry || '',
        internal_notes: account.internal_notes || '',
      })
    }
  }, [account, editOpen])

  // Stock orders linked to this retail account
  const { data: stockOrders } = useQuery({
    queryKey: ['retail-account-stock-orders', retailAccountId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customer_orders')
        .select('id, shopify_order_number, total_price, financial_status, fulfillment_status, line_items, shopify_created_at')
        .eq('retail_account_id', retailAccountId)
        .order('shopify_created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
    enabled: !!retailAccountId,
  })

  // Work items linked to this retail account
  const { data: workItemOrders } = useQuery({
    queryKey: ['retail-account-work-items', retailAccountId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('work_items')
        .select('id, title, status, shopify_order_number, customer_name, created_at, order_total')
        .eq('retail_account_id', retailAccountId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data
    },
    enabled: !!retailAccountId,
  })

  const handleEditChange = (field: string, value: string) => setEditForm(prev => ({ ...prev, [field]: value }))

  const handleEditSave = async () => {
    if (!editForm.account_name.trim()) { toast.error('Account name is required'); return }
    try {
      await updateAccount.mutateAsync({
        id: retailAccountId,
        updates: {
          account_name: editForm.account_name, account_type: editForm.account_type as any,
          primary_contact_name: editForm.primary_contact_name || null,
          primary_contact_email: editForm.primary_contact_email || null,
          primary_contact_phone: editForm.primary_contact_phone || null,
          billing_email: editForm.billing_email || null,
          business_address: editForm.business_address || null, city: editForm.city || null,
          state: editForm.state || null, zip_code: editForm.zip_code || null,
          website_url: editForm.website_url || null, tax_id: editForm.tax_id || null,
          credit_limit: editForm.credit_limit ? Number(editForm.credit_limit) : null,
          payment_terms: editForm.payment_terms || null, industry: editForm.industry || null,
          internal_notes: editForm.internal_notes || null,
        },
      })
      toast.success('Account updated')
      setEditOpen(false)
    } catch { toast.error('Failed to update account') }
  }

  const handleSaveNotes = async () => {
    try {
      await updateAccount.mutateAsync({ id: retailAccountId, updates: { internal_notes: notesValue || null } })
      toast.success('Notes saved')
      setIsEditingNotes(false)
    } catch { toast.error('Failed to save notes') }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateAccount.mutateAsync({ id: retailAccountId, updates: { status: newStatus as any } })
      toast.success(`Status changed to ${newStatus}`)
    } catch { toast.error('Failed to update status') }
  }

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading account...</div>
  if (!account) return (
    <Card><CardContent className="py-8 text-center text-muted-foreground">
      <Building2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
      <p>No B2B account linked</p>
    </CardContent></Card>
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'on_hold': return 'bg-red-100 text-red-800'
      case 'prospect': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      {/* Account Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge className={getStatusColor(account.status)} variant="secondary">{account.status}</Badge>
          {account.payment_terms && (
            <Badge variant="outline" className="gap-1"><CreditCard className="h-3 w-3" />{account.payment_terms}</Badge>
          )}
          {account.industry && <Badge variant="outline">{account.industry}</Badge>}
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
          <Edit className="h-4 w-4" />Edit Account
        </Button>
      </div>

      {/* Status Quick Actions */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        {(['prospect', 'active', 'on_hold', 'inactive'] as const).map((s) => (
          <Button key={s} size="sm" variant={account.status === s ? 'default' : 'outline'}
            onClick={() => handleStatusChange(s)} className="h-7 text-xs capitalize">
            {s.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-muted/40">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Revenue</div>
            <div className="text-lg font-bold text-green-600">${Number(account.total_revenue || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-muted/40">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Orders</div>
            <div className="text-lg font-bold">{account.total_orders || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-muted/40">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Credit Limit</div>
            <div className="text-lg font-bold">{account.credit_limit ? `$${Number(account.credit_limit).toLocaleString()}` : '-'}</div>
          </CardContent>
        </Card>
        <Card className="border-muted/40">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Last Order</div>
            <div className="text-lg font-bold">
              {account.last_order_date ? formatDistanceToNow(new Date(account.last_order_date), { addSuffix: false }) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact & Business Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-muted/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><User className="h-4 w-4" />Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {account.primary_contact_name && <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" />{account.primary_contact_name}</div>}
            {account.primary_contact_email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><a href={`mailto:${account.primary_contact_email}`} className="text-primary hover:underline">{account.primary_contact_email}</a></div>}
            {account.primary_contact_phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{account.primary_contact_phone}</div>}
            {account.billing_email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Billing:</span> {account.billing_email}</div>}
            {account.website_url && <div className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-muted-foreground" /><a href={account.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{account.website_url}</a></div>}
          </CardContent>
        </Card>
        <Card className="border-muted/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Building2 className="h-4 w-4" />Business</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {account.business_address && <div className="flex items-start gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" /><span>{account.business_address}{account.city && `, ${account.city}`}{account.state && `, ${account.state}`}{account.zip_code && ` ${account.zip_code}`}</span></div>}
            {account.tax_id && <div><span className="text-muted-foreground">Tax ID:</span> {account.tax_id}</div>}
            {account.credit_limit && <div><span className="text-muted-foreground">Credit:</span> ${Number(account.credit_limit).toLocaleString()}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Orders */}
      {(stockOrders && stockOrders.length > 0) && (
        <Card className="border-muted/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Stock Purchases ({stockOrders.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground text-xs">
                  <th className="pb-2 pr-3 font-medium">Order</th><th className="pb-2 pr-3 font-medium">Items</th>
                  <th className="pb-2 pr-3 font-medium">Payment</th><th className="pb-2 pr-3 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr></thead>
                <tbody>
                  {stockOrders.map((order: any) => {
                    const itemCount = Array.isArray(order.line_items) ? order.line_items.reduce((s: number, li: any) => s + (li.quantity || 1), 0) : 0
                    return (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{order.shopify_order_number || '-'}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{itemCount} item{itemCount !== 1 ? 's' : ''}</td>
                        <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{(order.financial_status || 'unknown').replace(/_/g, ' ')}</Badge></td>
                        <td className="py-2 pr-3 text-right font-medium">{order.total_price ? `$${Number(order.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}</td>
                        <td className="py-2 text-muted-foreground">{order.shopify_created_at ? format(new Date(order.shopify_created_at), 'MMM d, yyyy') : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {(workItemOrders && workItemOrders.length > 0) && (
        <Card className="border-muted/40">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Custom Projects ({workItemOrders.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground text-xs">
                  <th className="pb-2 pr-3 font-medium">Order</th><th className="pb-2 pr-3 font-medium">Title</th>
                  <th className="pb-2 pr-3 font-medium">Status</th><th className="pb-2 pr-3 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr></thead>
                <tbody>
                  {workItemOrders.map((order: any) => (
                    <tr key={order.id} className="border-b last:border-0">
                      <td className="py-2 pr-3"><Link href={`/work-items/${order.id}`} className="text-primary hover:underline font-medium">{order.shopify_order_number || 'View'}</Link></td>
                      <td className="py-2 pr-3 max-w-[200px] truncate">{order.title || '-'}</td>
                      <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{(order.status || '').replace(/_/g, ' ')}</Badge></td>
                      <td className="py-2 pr-3 text-right">{order.order_total ? `$${Number(order.order_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-'}</td>
                      <td className="py-2 text-muted-foreground">{order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Internal Notes */}
      <Card className="border-muted/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Lock className="h-4 w-4" />Internal Notes</CardTitle>
            {!isEditingNotes && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => { setNotesValue(account.internal_notes || ''); setIsEditingNotes(true) }}>
                <Edit className="h-3 w-3" />{account.internal_notes ? 'Edit' : 'Add'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingNotes ? (
            <div className="space-y-2">
              <Textarea value={notesValue} onChange={(e) => setNotesValue(e.target.value)} rows={4} placeholder="Private notes about this account..." />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNotes} disabled={updateAccount.isPending} className="gap-1">
                  {updateAccount.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingNotes(false)}>Cancel</Button>
              </div>
            </div>
          ) : account.internal_notes ? (
            <div className="whitespace-pre-wrap text-sm">{account.internal_notes}</div>
          ) : (
            <div className="text-sm text-muted-foreground py-4 text-center">No internal notes yet</div>
          )}
        </CardContent>
      </Card>

      {/* Edit Account Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update B2B account details for {account.account_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Account Name <span className="text-red-500">*</span></Label><Input value={editForm.account_name} onChange={(e) => handleEditChange('account_name', e.target.value)} /></div>
                <div className="space-y-2"><Label>Account Type</Label>
                  <Select value={editForm.account_type} onValueChange={(v) => handleEditChange('account_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="retailer">Retailer</SelectItem><SelectItem value="corporate">Corporate</SelectItem><SelectItem value="venue">Venue</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Industry</Label><Input value={editForm.industry} onChange={(e) => handleEditChange('industry', e.target.value)} placeholder="Retail, Events, etc." /></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contact</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Contact Name</Label><Input value={editForm.primary_contact_name} onChange={(e) => handleEditChange('primary_contact_name', e.target.value)} /></div>
                <div className="space-y-2"><Label>Contact Email</Label><Input type="email" value={editForm.primary_contact_email} onChange={(e) => handleEditChange('primary_contact_email', e.target.value)} /></div>
                <div className="space-y-2"><Label>Contact Phone</Label><Input type="tel" value={editForm.primary_contact_phone} onChange={(e) => handleEditChange('primary_contact_phone', e.target.value)} /></div>
                <div className="space-y-2"><Label>Billing Email</Label><Input type="email" value={editForm.billing_email} onChange={(e) => handleEditChange('billing_email', e.target.value)} /></div>
                <div className="space-y-2 col-span-2"><Label>Website</Label><Input type="url" value={editForm.website_url} onChange={(e) => handleEditChange('website_url', e.target.value)} placeholder="https://..." /></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Address</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2"><Label>Street Address</Label><Input value={editForm.business_address} onChange={(e) => handleEditChange('business_address', e.target.value)} /></div>
                <div className="space-y-2"><Label>City</Label><Input value={editForm.city} onChange={(e) => handleEditChange('city', e.target.value)} /></div>
                <div className="space-y-2"><Label>State</Label><Input value={editForm.state} onChange={(e) => handleEditChange('state', e.target.value)} /></div>
                <div className="space-y-2"><Label>Zip</Label><Input value={editForm.zip_code} onChange={(e) => handleEditChange('zip_code', e.target.value)} /></div>
                <div className="space-y-2"><Label>Tax ID</Label><Input value={editForm.tax_id} onChange={(e) => handleEditChange('tax_id', e.target.value)} /></div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Payment</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Credit Limit ($)</Label><Input type="number" value={editForm.credit_limit} onChange={(e) => handleEditChange('credit_limit', e.target.value)} /></div>
                <div className="space-y-2"><Label>Payment Terms</Label>
                  <Select value={editForm.payment_terms} onValueChange={(v) => handleEditChange('payment_terms', v)}>
                    <SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger>
                    <SelectContent><SelectItem value="Due on Receipt">Due on Receipt</SelectItem><SelectItem value="Net 15">Net 15</SelectItem><SelectItem value="Net 30">Net 30</SelectItem><SelectItem value="Net 60">Net 60</SelectItem><SelectItem value="Net 90">Net 90</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Notes</h4>
              <Textarea value={editForm.internal_notes} onChange={(e) => handleEditChange('internal_notes', e.target.value)} rows={3} placeholder="Private notes..." />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={updateAccount.isPending} className="gap-2">
                {updateAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Main Customer Profile Page
export default function CustomerProfilePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const customerId = params.id as string
  const queryClient = useQueryClient()
  const initialTab = searchParams.get('tab') || 'projects'
  const { data: profileData, isLoading } = useCustomerProfile(customerId)
  const { data: allUsers } = useAllUsers()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  const handleClaimCustomer = async () => {
    if (!currentUserId) return
    const supabase = createClient()
    const { error } = await supabase
      .from('customers')
      .update({ assigned_to_user_id: currentUserId })
      .eq('id', customerId)
    if (error) {
      toast.error('Failed to claim customer')
      return
    }
    toast.success('Customer claimed')
    queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
  }

  const handleReassignCustomer = async (userId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('customers')
      .update({ assigned_to_user_id: userId })
      .eq('id', customerId)
    if (error) {
      toast.error('Failed to reassign customer')
      return
    }
    toast.success('Customer reassigned')
    queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
  }

  const handleSetCustomerType = async (type: 'individual' | 'retailer' | 'organization') => {
    const supabase = createClient()
    const { error } = await supabase
      .from('customers')
      .update({ customer_type: type })
      .eq('id', customerId)
    if (error) {
      toast.error('Failed to update customer type')
      return
    }
    toast.success(`Customer marked as ${type}`)
    queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
  }

  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false)

  const handleSetFollowUp = async (daysFromNow: number | null, specificDate?: string) => {
    const supabase = createClient()
    let followUpDate: string | null = null
    if (specificDate) {
      followUpDate = new Date(specificDate + 'T09:00:00').toISOString()
    } else if (daysFromNow !== null) {
      followUpDate = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString()
    }

    // When clearing a win-back follow-up, auto-advance to the next touch
    if (followUpDate === null && customer.follow_up_reason === 'win-back' &&
        customer.follow_up_touch_number && customer.follow_up_max_touches &&
        customer.follow_up_touch_number < customer.follow_up_max_touches) {
      const { WIN_BACK_CADENCES } = await import('@/components/work-items/close-lead-dialog')
      // Find the close reason from the most recent closed work item
      const { data: lastClosed } = await supabase
        .from('work_items')
        .select('close_reason')
        .eq('customer_id', customerId)
        .not('closed_at', 'is', null)
        .not('close_reason', 'is', null)
        .order('closed_at', { ascending: false })
        .limit(1)
        .single()

      const closeReason = lastClosed?.close_reason || ''
      const cadence = WIN_BACK_CADENCES[closeReason]
      const nextTouchIndex = customer.follow_up_touch_number // 0-based index for next touch
      if (cadence && nextTouchIndex < cadence.length) {
        const nextDays = cadence[nextTouchIndex]
        const nextTouchNumber = customer.follow_up_touch_number + 1
        const { error } = await supabase
          .from('customers')
          .update({
            next_follow_up_at: new Date(Date.now() + nextDays * 24 * 60 * 60 * 1000).toISOString(),
            follow_up_touch_number: nextTouchNumber,
          })
          .eq('id', customerId)
        if (error) {
          toast.error('Failed to advance win-back cadence')
          return
        }
        toast.success(`Win-back touch ${nextTouchNumber} of ${customer.follow_up_max_touches} scheduled`)
        setShowFollowUpPicker(false)
        queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
        queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
        return
      }
    }

    // Normal follow-up set/clear
    const updateData: Record<string, unknown> = { next_follow_up_at: followUpDate }
    if (followUpDate === null) {
      // Clearing: also clear cadence tracking
      updateData.follow_up_reason = null
      updateData.follow_up_touch_number = null
      updateData.follow_up_max_touches = null
    } else if (!customer.follow_up_reason) {
      // Setting manually: tag as manual
      updateData.follow_up_reason = 'manual'
    }

    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customerId)
    if (error) {
      toast.error('Failed to set follow-up')
      return
    }
    toast.success(followUpDate ? 'Follow-up set' : 'Follow-up cleared')
    setShowFollowUpPicker(false)
    queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
    queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
  }

  const handleAcknowledgeReply = async () => {
    const supabase = createClient()
    const { error } = await supabase
      .from('customers')
      .update({ last_outbound_at: new Date().toISOString() })
      .eq('id', customerId)
    if (error) {
      toast.error('Failed to acknowledge')
      return
    }
    toast.success('Marked as no reply needed')
    queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
    queryClient.invalidateQueries({ queryKey: ['morning-briefing'] })
  }

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

  const { customer, retail_account, projects, stats } = profileData

  // Derive display names based on customer type
  const isBusinessCustomer = customer.customer_type === 'retailer' || customer.customer_type === 'organization'
  const businessName = customer.organization_name || retail_account?.account_name || null
  const personName = customer.display_name ||
    (customer.first_name && customer.last_name
      ? `${customer.first_name} ${customer.last_name}`
      : customer.first_name || customer.last_name || null)
  const headerName = (isBusinessCustomer && businessName) ? businessName : (personName || customer.email)

  // Show Shopify tab only if customer has a Shopify connection
  const hasShopifyConnection = !!customer.shopify_customer_id ||
    projects.some((p: any) => !!p.shopify_order_number)

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header - PDR v3 Spec */}
      <div className="space-y-3 sm:space-y-4">
        {/* Breadcrumb */}
        <Breadcrumbs
          items={[{ label: 'Customers', href: '/customers' }]}
          current={headerName}
        />

        {/* Customer Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            {/* Name + Type badges */}
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              {headerName}
            </h1>

            {/* Badges row — separated from h1 for clean alignment */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {customer.customer_type === 'retailer' && (
                <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">Retailer</Badge>
              )}
              {customer.customer_type === 'organization' && (
                <Badge variant="outline" className="text-purple-600 border-purple-300 text-xs">Organization</Badge>
              )}
              {customer.status && (
                <Badge variant="outline" className="text-xs">
                  {customer.status}
                </Badge>
              )}
              {/* Response Tracking Badge */}
              {(() => {
                const lastIn = customer.last_inbound_at ? new Date(customer.last_inbound_at) : null
                const lastOut = customer.last_outbound_at ? new Date(customer.last_outbound_at) : null
                if (lastIn && (!lastOut || lastIn > lastOut)) {
                  const days = Math.floor((Date.now() - lastIn.getTime()) / (1000 * 60 * 60 * 24))
                  if (days >= 1) return (
                    <>
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs gap-1">
                        <Clock className="h-3 w-3" />
                        Needs reply {days}d
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={handleAcknowledgeReply}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                        Dismiss
                      </Button>
                    </>
                  )
                }
                if (lastOut && (!lastIn || lastOut > lastIn)) {
                  const days = Math.floor((Date.now() - lastOut.getTime()) / (1000 * 60 * 60 * 24))
                  if (days >= 2) return (
                    <Badge variant="outline" className="text-muted-foreground border-muted text-xs gap-1">
                      <Clock className="h-3 w-3" />
                      Waiting {days}d
                    </Badge>
                  )
                }
                return null
              })()}
            </div>

            {/* Contact Info — layout differs for business vs individual */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-3 text-sm text-muted-foreground mt-2">
              {/* Business customers: show primary contact person */}
              {isBusinessCustomer && personName && personName !== customer.email && (
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="font-medium text-foreground">{personName}</span>
                  <span className="text-muted-foreground text-xs">· Primary Contact</span>
                </div>
              )}
              {/* Individual customers: show org name if present */}
              {!isBusinessCustomer && customer.organization_name && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{customer.organization_name}</span>
                </div>
              )}
              {/* Email — hide if it's already showing as headerName or personName */}
              {customer.email && headerName !== customer.email && personName !== customer.email && (
                <div className="flex items-center gap-1.5 min-w-0">
                  <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{customer.phone}</span>
                </div>
              )}
            </div>

            {/* Assigned To */}
            <div className="flex items-center gap-2 mt-2 text-sm">
              <UserCircle className="h-4 w-4 text-muted-foreground" />
              {customer.assigned_to_user_id ? (
                <>
                  <span className="text-muted-foreground">Assigned to:</span>
                  <span className="font-medium">
                    {allUsers?.find((u) => u.id === customer.assigned_to_user_id)?.full_name || 'Unknown'}
                  </span>
                  <select
                    className="ml-2 text-xs border rounded px-1.5 py-0.5 bg-background text-foreground"
                    value={customer.assigned_to_user_id}
                    onChange={(e) => handleReassignCustomer(e.target.value)}
                  >
                    {allUsers?.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">Unassigned</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1 ml-1" onClick={handleClaimCustomer}>
                    <User className="h-3 w-3" />
                    Claim
                  </Button>
                </>
              )}
            </div>

            {/* Follow-Up Reminder */}
            <div className="flex items-center gap-2 mt-2 text-sm">
              <Bell className="h-4 w-4 text-muted-foreground" />
              {customer.next_follow_up_at ? (
                <>
                  <span className="text-muted-foreground">Follow-up:</span>
                  <span className={`font-medium ${new Date(customer.next_follow_up_at) <= new Date() ? 'text-red-600' : ''}`}>
                    {format(new Date(customer.next_follow_up_at), 'MMM d, yyyy')}
                    {new Date(customer.next_follow_up_at) <= new Date() && ' (overdue)'}
                  </span>
                  {customer.follow_up_reason === 'post-delivery' && (
                    <Badge variant="outline" className="text-[11px] gap-0.5 px-1.5 py-0 text-green-700 border-green-300">
                      <PackageCheck className="h-2.5 w-2.5" />
                      Post-delivery
                    </Badge>
                  )}
                  {customer.follow_up_reason === 'win-back' && customer.follow_up_touch_number && customer.follow_up_max_touches && (
                    <Badge variant="outline" className="text-[11px] gap-0.5 px-1.5 py-0 text-orange-700 border-orange-300">
                      <RotateCcw className="h-2.5 w-2.5" />
                      Win-back {customer.follow_up_touch_number}/{customer.follow_up_max_touches}
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs text-muted-foreground" onClick={() => handleSetFollowUp(null)}>
                    Clear
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground">No follow-up set</span>
              )}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  onClick={() => setShowFollowUpPicker(!showFollowUpPicker)}
                >
                  <Calendar className="h-3 w-3" />
                  Set
                </Button>
                {showFollowUpPicker && (
                  <div className="absolute top-8 left-0 z-50 bg-popover border rounded-lg shadow-lg p-2 space-y-1 min-w-[180px]">
                    {[
                      { label: '1 week', days: 7 },
                      { label: '2 weeks', days: 14 },
                      { label: '1 month', days: 30 },
                      { label: '2 months', days: 60 },
                      { label: '3 months', days: 90 },
                      { label: '6 months', days: 180 },
                    ].map((opt) => (
                      <Button
                        key={opt.days}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs h-7"
                        onClick={() => handleSetFollowUp(opt.days)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                    <div className="border-t pt-1 mt-1">
                      <input
                        type="date"
                        className="w-full text-xs px-2 py-1.5 border rounded bg-background text-foreground cursor-pointer"
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => {
                          if (e.target.value) handleSetFollowUp(null, e.target.value)
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Key Contacts */}
            {alternativeContacts && alternativeContacts.length > 0 && (
              <div className={isBusinessCustomer ? 'mt-3' : 'mt-3 pt-3 border-t'}>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground mb-2">
                  {isBusinessCustomer ? 'Key Contacts:' : 'Additional Contacts:'}
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
                          <span className="text-muted-foreground hidden sm:inline">·</span>
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

            {/* B2B Details Bar — only for retailers/orgs with linked retail account */}
            {isBusinessCustomer && retail_account && (
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                {retail_account.business_address && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>
                      {retail_account.business_address}
                      {retail_account.city && `, ${retail_account.city}`}
                      {retail_account.state && `, ${retail_account.state}`}
                      {retail_account.zip_code && ` ${retail_account.zip_code}`}
                    </span>
                  </div>
                )}
                {retail_account.payment_terms && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>{retail_account.payment_terms}</span>
                  </div>
                )}
                {retail_account.credit_limit && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>Credit: ${retail_account.credit_limit.toLocaleString()}</span>
                  </div>
                )}
                {retail_account.website_url && (
                  <a href={retail_account.website_url} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1.5 text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Website</span>
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <EmailComposer
                recipientEmail={customer.email}
                recipientName={customer.display_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email}
                customerId={customerId}
                alternativeContacts={alternativeContacts || []}
                trigger={
                  <Button className="gap-2 h-9">
                    <Mail className="h-4 w-4" />
                    Email
                  </Button>
                }
              />
              <CreateProjectDialog
                customerId={customerId}
                onProjectCreated={(projectId) => {
                  queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
                }}
                trigger={
                  <Button variant="outline" className="gap-2 h-9">
                    <Plus className="h-4 w-4" />
                    Project
                  </Button>
                }
              />
              {customer.shopify_customer_id && (
                <Button variant="outline" className="gap-2 h-9" size="sm" asChild>
                  <a
                    href={`https://${process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN}/admin/customers/${customer.shopify_customer_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Shopify
                  </a>
                </Button>
              )}
            </div>
            {/* Customer Type Actions */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Type:</span>
              {(['individual', 'retailer', 'organization'] as const).map((type) => (
                <Button
                  key={type}
                  variant={customer.customer_type === type ? 'default' : 'ghost'}
                  size="sm"
                  className={`h-7 text-xs px-2.5 ${customer.customer_type === type ? '' : 'text-muted-foreground'}`}
                  onClick={() => handleSetCustomerType(type)}
                  disabled={customer.customer_type === type}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI Summary */}
      <SummaryPanel customerId={customerId} />

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
          <Tabs defaultValue={initialTab} className="space-y-4">
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
              {hasShopifyConnection && (
                <TabsTrigger value="shopify" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                  <ShoppingBag className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Shopify</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="files" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Files</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                <StickyNote className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">Notes</span>
              </TabsTrigger>
              {isBusinessCustomer && customer.retail_account_id && (
                <TabsTrigger value="b2b" className="gap-1.5 sm:gap-2 flex-1 min-w-[85px] sm:min-w-[100px] h-10 sm:h-11 text-sm">
                  <Package className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">B2B Account</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-4">
              {projects.length === 0 ? (
                /* No projects yet */
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      This customer doesn't have any projects.
                    </p>
                    <CreateProjectDialog
                      customerId={customerId}
                      onProjectCreated={(projectId) => {
                        queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
                      }}
                      trigger={
                        <Button>
                          <Plus className="mr-2 h-4 w-4" />
                          Create First Project
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              ) : (
                /* Project list */
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">
                      {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                      {projects.filter(p => p.closed_at).length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          ({projects.filter(p => !p.closed_at).length} active, {projects.filter(p => p.closed_at).length} closed)
                        </span>
                      )}
                    </h3>
                    <CreateProjectDialog
                      customerId={customerId}
                      onProjectCreated={(projectId) => {
                        queryClient.invalidateQueries({ queryKey: ['customer-profile', customerId] })
                      }}
                      trigger={
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          New Project
                        </Button>
                      }
                    />
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

            {/* Shopify Orders Tab */}
            {hasShopifyConnection && (
              <TabsContent value="shopify">
                <ShopifyOrdersTab
                  customerId={customerId}
                  customerEmail={customer.email}
                />
              </TabsContent>
            )}

            {/* Files Tab */}
            <TabsContent value="files">
              <FilesTab customerId={customerId} />
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes">
              <NotesTab customerId={customerId} />
            </TabsContent>

            {/* B2B Account Tab — only for retailer/org with linked retail account */}
            {isBusinessCustomer && customer.retail_account_id && (
              <TabsContent value="b2b">
                <B2BAccountTab retailAccountId={customer.retail_account_id} />
              </TabsContent>
            )}
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
                  {stats.total_spent > 0
                    ? stats.total_spent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '0.00'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
