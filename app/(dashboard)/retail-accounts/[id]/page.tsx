'use client'

import { use, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  FileText,
  Edit,
  Trash2,
  ExternalLink,
  TrendingUp,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'
import { useRetailAccount, useUpdateRetailAccount, useDeleteRetailAccount } from '@/lib/hooks/use-retail-accounts'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { InternalNotes } from '@/components/work-items/internal-notes'

export default function RetailAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: account, isLoading } = useRetailAccount(id)
  const updateAccount = useUpdateRetailAccount()
  const deleteAccount = useDeleteRetailAccount()

  const [isEditing, setIsEditing] = useState(false)

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
        <div className="flex items-start gap-4">
          <Link href="/retail-accounts">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

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
            <Button variant="outline" size="sm" className="gap-2">
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
          <TabsTrigger value="orders">Orders</TabsTrigger>
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

        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Order history will be displayed here</p>
                <p className="text-xs">Link work items to this account to see order history</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <InternalNotes workItemId={id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
