'use client'

import { use, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  DollarSign,
  Package,
  Calendar,
  User,
  Edit,
  Trash2,
  ExternalLink,
  TrendingUp,
  CreditCard,
  Loader2,
  Save,
  Lock,
  FileText,
} from 'lucide-react'
import Link from 'next/link'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'
import { useRetailAccount, useUpdateRetailAccount, useDeleteRetailAccount } from '@/lib/hooks/use-retail-accounts'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export default function RetailAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: account, isLoading } = useRetailAccount(id)
  const updateAccount = useUpdateRetailAccount()
  const deleteAccount = useDeleteRetailAccount()

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    account_name: '',
    account_type: 'retailer',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    billing_email: '',
    business_address: '',
    city: '',
    state: '',
    zip_code: '',
    website_url: '',
    tax_id: '',
    credit_limit: '',
    payment_terms: '',
    industry: '',
    internal_notes: '',
  })

  // Notes editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  // Sync account data into edit form when dialog opens
  useEffect(() => {
    if (account && editOpen) {
      setEditForm({
        account_name: account.account_name || '',
        account_type: account.account_type || 'retailer',
        primary_contact_name: account.primary_contact_name || '',
        primary_contact_email: account.primary_contact_email || '',
        primary_contact_phone: account.primary_contact_phone || '',
        billing_email: account.billing_email || '',
        business_address: account.business_address || '',
        city: account.city || '',
        state: account.state || '',
        zip_code: account.zip_code || '',
        website_url: account.website_url || '',
        tax_id: account.tax_id || '',
        credit_limit: account.credit_limit ? String(account.credit_limit) : '',
        payment_terms: account.payment_terms || '',
        industry: account.industry || '',
        internal_notes: account.internal_notes || '',
      })
    }
  }, [account, editOpen])

  // Custom project orders (work items linked to this account)
  const { data: workItemOrders, isLoading: workItemsLoading } = useQuery({
    queryKey: ['retail-account-work-items', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('work_items')
        .select('id, title, status, shopify_order_number, customer_name, customer_email, created_at, order_total')
        .eq('retail_account_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  // Stock purchase orders (customer_orders linked to this account)
  const { data: stockOrders, isLoading: stockOrdersLoading } = useQuery({
    queryKey: ['retail-account-stock-orders', id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customer_orders')
        .select('id, shopify_order_number, shopify_order_id, order_type, total_price, currency, financial_status, fulfillment_status, line_items, shopify_created_at')
        .eq('retail_account_id', id)
        .order('shopify_created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const ordersLoading = workItemsLoading || stockOrdersLoading
  const totalOrderCount = (workItemOrders?.length || 0) + (stockOrders?.length || 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      case 'on_hold':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'prospect':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${account?.account_name}? This cannot be undone.`)) {
      return
    }

    try {
      await deleteAccount.mutateAsync(id)
      toast.success('Account deleted')
      router.push('/retail-accounts')
    } catch (error) {
      toast.error('Failed to delete account')
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateAccount.mutateAsync({
        id,
        updates: { status: newStatus as any }
      })
      toast.success(`Status changed to ${newStatus}`)
    } catch (error) {
      toast.error('Failed to update status')
    }
  }

  const handleEditChange = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const handleEditSave = async () => {
    if (!editForm.account_name.trim()) {
      toast.error('Account name is required')
      return
    }

    try {
      await updateAccount.mutateAsync({
        id,
        updates: {
          account_name: editForm.account_name,
          account_type: editForm.account_type as any,
          primary_contact_name: editForm.primary_contact_name || null,
          primary_contact_email: editForm.primary_contact_email || null,
          primary_contact_phone: editForm.primary_contact_phone || null,
          billing_email: editForm.billing_email || null,
          business_address: editForm.business_address || null,
          city: editForm.city || null,
          state: editForm.state || null,
          zip_code: editForm.zip_code || null,
          website_url: editForm.website_url || null,
          tax_id: editForm.tax_id || null,
          credit_limit: editForm.credit_limit ? Number(editForm.credit_limit) : null,
          payment_terms: editForm.payment_terms || null,
          industry: editForm.industry || null,
          internal_notes: editForm.internal_notes || null,
        },
      })
      toast.success('Account updated')
      setEditOpen(false)
    } catch (error) {
      toast.error('Failed to update account')
    }
  }

  const handleSaveNotes = async () => {
    try {
      await updateAccount.mutateAsync({
        id,
        updates: { internal_notes: notesValue || null },
      })
      toast.success('Notes saved')
      setIsEditingNotes(false)
    } catch (error) {
      toast.error('Failed to save notes')
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading account...</p>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="p-6">
        <p>Account not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Breadcrumbs
          items={[{ label: 'Retail Accounts', href: '/retail-accounts' }]}
          current={account.account_name}
        />
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">{account.account_name}</h1>
                <p className="text-sm text-muted-foreground capitalize">
                  {account.account_type} Account
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap mt-4">
              <Badge className={getStatusColor(account.status)} variant="secondary">
                {account.status}
              </Badge>
              {account.payment_terms && (
                <Badge variant="outline" className="gap-1">
                  <CreditCard className="h-3 w-3" />
                  {account.payment_terms}
                </Badge>
              )}
              {account.industry && (
                <Badge variant="outline">{account.industry}</Badge>
              )}
              {account.tags && account.tags.length > 0 && (
                account.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary">{tag}</Badge>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Edit className="h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${Number(account.total_revenue || 0).toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{account.total_orders || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${account.total_orders && account.total_orders > 0
                ? (Number(account.total_revenue || 0) / account.total_orders).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })
                : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Per order</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Order</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {account.last_order_date ? (
              <>
                <div className="text-2xl font-bold">
                  {formatDistanceToNow(new Date(account.last_order_date), {
                    addSuffix: false,
                  })}
                </div>
                <p className="text-xs text-muted-foreground">ago</p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No orders yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Account Status</h3>
              <p className="text-sm text-muted-foreground">
                Change the status of this account
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={account.status === 'prospect' ? 'default' : 'outline'}
                onClick={() => handleStatusChange('prospect')}
              >
                Prospect
              </Button>
              <Button
                size="sm"
                variant={account.status === 'active' ? 'default' : 'outline'}
                onClick={() => handleStatusChange('active')}
              >
                Active
              </Button>
              <Button
                size="sm"
                variant={account.status === 'on_hold' ? 'default' : 'outline'}
                onClick={() => handleStatusChange('on_hold')}
              >
                On Hold
              </Button>
              <Button
                size="sm"
                variant={account.status === 'inactive' ? 'default' : 'outline'}
                onClick={() => handleStatusChange('inactive')}
              >
                Inactive
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">Account Info</TabsTrigger>
          <TabsTrigger value="orders">
            Orders{totalOrderCount > 0 ? ` (${totalOrderCount})` : ''}
          </TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-4">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {account.primary_contact_name && (
                  <div>
                    <span className="text-sm text-muted-foreground">Primary Contact</span>
                    <p className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {account.primary_contact_name}
                    </p>
                  </div>
                )}
                {account.primary_contact_email && (
                  <div>
                    <span className="text-sm text-muted-foreground">Email</span>
                    <a
                      href={`mailto:${account.primary_contact_email}`}
                      className="font-medium flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {account.primary_contact_email}
                    </a>
                  </div>
                )}
                {account.primary_contact_phone && (
                  <div>
                    <span className="text-sm text-muted-foreground">Phone</span>
                    <a
                      href={`tel:${account.primary_contact_phone}`}
                      className="font-medium flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {account.primary_contact_phone}
                    </a>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {account.billing_email && (
                  <div>
                    <span className="text-sm text-muted-foreground">Billing Email</span>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {account.billing_email}
                    </p>
                  </div>
                )}
                {account.website_url && (
                  <div>
                    <span className="text-sm text-muted-foreground">Website</span>
                    <a
                      href={account.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {account.website_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Business Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {account.business_address && (
                  <div>
                    <span className="text-sm text-muted-foreground">Address</span>
                    <p className="font-medium flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                      <span>
                        {account.business_address}
                        {account.city && `, ${account.city}`}
                        {account.state && `, ${account.state}`}
                        {account.zip_code && ` ${account.zip_code}`}
                      </span>
                    </p>
                  </div>
                )}
                {account.tax_id && (
                  <div>
                    <span className="text-sm text-muted-foreground">Tax ID</span>
                    <p className="font-medium">{account.tax_id}</p>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {account.credit_limit && (
                  <div>
                    <span className="text-sm text-muted-foreground">Credit Limit</span>
                    <p className="font-medium flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      ${Number(account.credit_limit).toLocaleString()}
                    </p>
                  </div>
                )}
                {account.shopify_customer_id && (
                  <div>
                    <span className="text-sm text-muted-foreground">Shopify Customer</span>
                    <a
                      href={`https://admin.shopify.com/store/gayfanclub/customers/${account.shopify_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium flex items-center gap-2 text-blue-600 hover:underline"
                    >
                      View in Shopify
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Order History Tab */}
        <TabsContent value="orders" className="space-y-4">
          {ordersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : totalOrderCount === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No orders linked to this account yet</p>
                  <p className="text-xs mt-1">
                    Stock orders from Shopify will appear here automatically when matched to this account
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Stock Purchases (from customer_orders) */}
              {stockOrders && stockOrders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Stock Purchases ({stockOrders.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Order</th>
                            <th className="pb-2 pr-4 font-medium">Items</th>
                            <th className="pb-2 pr-4 font-medium">Payment</th>
                            <th className="pb-2 pr-4 font-medium">Fulfillment</th>
                            <th className="pb-2 pr-4 font-medium text-right">Total</th>
                            <th className="pb-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stockOrders.map((order: any) => {
                            const itemCount = Array.isArray(order.line_items)
                              ? order.line_items.reduce((sum: number, li: any) => sum + (li.quantity || 1), 0)
                              : 0
                            const itemSummary = Array.isArray(order.line_items)
                              ? order.line_items.map((li: any) => li.title).slice(0, 2).join(', ')
                              : ''
                            return (
                              <tr key={order.id} className="border-b last:border-0">
                                <td className="py-3 pr-4 font-medium">
                                  {order.shopify_order_number || '—'}
                                </td>
                                <td className="py-3 pr-4 max-w-[250px]">
                                  <span className="text-muted-foreground">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                                  {itemSummary && (
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                      {itemSummary}{Array.isArray(order.line_items) && order.line_items.length > 2 ? ` +${order.line_items.length - 2} more` : ''}
                                    </p>
                                  )}
                                </td>
                                <td className="py-3 pr-4">
                                  <Badge variant="outline" className="text-xs">
                                    {(order.financial_status || 'unknown').replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                                <td className="py-3 pr-4">
                                  <Badge variant="outline" className="text-xs">
                                    {order.fulfillment_status ? order.fulfillment_status.replace(/_/g, ' ') : 'unfulfilled'}
                                  </Badge>
                                </td>
                                <td className="py-3 pr-4 text-right font-medium">
                                  {order.total_price
                                    ? `$${Number(order.total_price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                    : '—'}
                                </td>
                                <td className="py-3 text-muted-foreground">
                                  {order.shopify_created_at
                                    ? format(new Date(order.shopify_created_at), 'MMM d, yyyy')
                                    : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custom Projects (from work_items) */}
              {workItemOrders && workItemOrders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Custom Projects ({workItemOrders.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Order</th>
                            <th className="pb-2 pr-4 font-medium">Title</th>
                            <th className="pb-2 pr-4 font-medium">Customer</th>
                            <th className="pb-2 pr-4 font-medium">Status</th>
                            <th className="pb-2 pr-4 font-medium text-right">Total</th>
                            <th className="pb-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workItemOrders.map((order: any) => (
                            <tr key={order.id} className="border-b last:border-0">
                              <td className="py-3 pr-4">
                                <Link
                                  href={`/work-items/${order.id}`}
                                  className="text-blue-600 hover:underline font-medium"
                                >
                                  {order.shopify_order_number || 'View'}
                                </Link>
                              </td>
                              <td className="py-3 pr-4 max-w-[200px] truncate">
                                {order.title || '—'}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {order.customer_name || order.customer_email || '—'}
                              </td>
                              <td className="py-3 pr-4">
                                <Badge variant="outline" className="text-xs">
                                  {(order.status || '').replace(/_/g, ' ')}
                                </Badge>
                              </td>
                              <td className="py-3 pr-4 text-right">
                                {order.order_total
                                  ? `$${Number(order.order_total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                  : '—'}
                              </td>
                              <td className="py-3 text-muted-foreground">
                                {order.created_at
                                  ? format(new Date(order.created_at), 'MMM d, yyyy')
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Internal Notes
                  <span className="text-sm text-muted-foreground font-normal">(Team only)</span>
                </CardTitle>
                {!isEditingNotes && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      setNotesValue(account.internal_notes || '')
                      setIsEditingNotes(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    {account.internal_notes ? 'Edit' : 'Add Notes'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isEditingNotes ? (
                <div className="space-y-3">
                  <Textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    rows={6}
                    placeholder="Private notes about this account (not visible to customers)..."
                    className="bg-background"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={updateAccount.isPending}
                      className="gap-2"
                    >
                      {updateAccount.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingNotes(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : account.internal_notes ? (
                <div className="whitespace-pre-wrap text-sm">{account.internal_notes}</div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No internal notes yet</p>
                  <p className="text-xs">Add private notes for team collaboration</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Account Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Update the details for {account.account_name}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Account Name <span className="text-red-500">*</span></Label>
                  <Input
                    value={editForm.account_name}
                    onChange={(e) => handleEditChange('account_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select value={editForm.account_type} onValueChange={(v) => handleEditChange('account_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retailer">Retailer</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="venue">Venue</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input
                    value={editForm.industry}
                    onChange={(e) => handleEditChange('industry', e.target.value)}
                    placeholder="Retail, Events, etc."
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={editForm.primary_contact_name}
                    onChange={(e) => handleEditChange('primary_contact_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={editForm.primary_contact_email}
                    onChange={(e) => handleEditChange('primary_contact_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Phone</Label>
                  <Input
                    type="tel"
                    value={editForm.primary_contact_phone}
                    onChange={(e) => handleEditChange('primary_contact_phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Billing Email</Label>
                  <Input
                    type="email"
                    value={editForm.billing_email}
                    onChange={(e) => handleEditChange('billing_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Website</Label>
                  <Input
                    type="url"
                    value={editForm.website_url}
                    onChange={(e) => handleEditChange('website_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Address</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Street Address</Label>
                  <Input
                    value={editForm.business_address}
                    onChange={(e) => handleEditChange('business_address', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={editForm.city} onChange={(e) => handleEditChange('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={editForm.state} onChange={(e) => handleEditChange('state', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Zip Code</Label>
                  <Input value={editForm.zip_code} onChange={(e) => handleEditChange('zip_code', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tax ID</Label>
                  <Input value={editForm.tax_id} onChange={(e) => handleEditChange('tax_id', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Payment */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Payment</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Credit Limit ($)</Label>
                  <Input
                    type="number"
                    value={editForm.credit_limit}
                    onChange={(e) => handleEditChange('credit_limit', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select value={editForm.payment_terms} onValueChange={(v) => handleEditChange('payment_terms', v)}>
                    <SelectTrigger><SelectValue placeholder="Select terms" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="Net 90">Net 90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Internal Notes</h4>
              <Textarea
                value={editForm.internal_notes}
                onChange={(e) => handleEditChange('internal_notes', e.target.value)}
                rows={3}
                placeholder="Private notes about this account..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleEditSave} disabled={updateAccount.isPending} className="gap-2">
                {updateAccount.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
