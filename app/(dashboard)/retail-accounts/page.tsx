'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Building2,
  Plus,
  Search,
  TrendingUp,
  DollarSign,
  Package,
  Users,
  ExternalLink,
  Mail,
  Phone,
  MapPin
} from 'lucide-react'
import Link from 'next/link'
import { useRetailAccounts } from '@/lib/hooks/use-retail-accounts'
import { formatDistanceToNow } from 'date-fns'

export default function RetailAccountsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: accounts, isLoading } = useRetailAccounts({
    search: searchQuery,
    status: statusFilter === 'all' ? undefined : statusFilter,
  })

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

  const activeAccounts = accounts?.filter(a => a.status === 'active') || []
  const totalRevenue = accounts?.reduce((sum, a) => sum + (Number(a.total_revenue) || 0), 0) || 0
  const totalOrders = accounts?.reduce((sum, a) => sum + (a.total_orders || 0), 0) || 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Retail Accounts</h1>
          <p className="text-muted-foreground">Manage B2B wholesale customer relationships</p>
        </div>
        <Link href="/retail-accounts/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Account
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAccounts.length}</div>
            <p className="text-xs text-muted-foreground">
              {accounts?.length || 0} total accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${totalRevenue.toLocaleString('en-US', {
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
            <div className="text-2xl font-bold">{totalOrders}</div>
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
              ${totalOrders > 0 ? (totalRevenue / totalOrders).toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">Per order</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="prospect">Prospects</TabsTrigger>
            <TabsTrigger value="on_hold">On Hold</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Accounts List */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading accounts...</p>
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Link key={account.id} href={`/retail-accounts/${account.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
                        <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-lg truncate">{account.account_name}</h3>
                        <p className="text-xs text-muted-foreground capitalize">
                          {account.account_type}
                        </p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(account.status)} variant="secondary">
                      {account.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Contact Info */}
                  <div className="space-y-1.5 text-sm">
                    {account.primary_contact_name && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{account.primary_contact_name}</span>
                      </div>
                    )}
                    {account.primary_contact_email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{account.primary_contact_email}</span>
                      </div>
                    )}
                    {account.city && account.state && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{account.city}, {account.state}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div>
                      <div className="text-xs text-muted-foreground">Revenue</div>
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${Number(account.total_revenue || 0).toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Orders</div>
                      <div className="text-lg font-bold">{account.total_orders || 0}</div>
                    </div>
                  </div>

                  {/* Last Order */}
                  {account.last_order_date && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Last order {formatDistanceToNow(new Date(account.last_order_date), {
                        addSuffix: true,
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Retail Accounts Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery
                ? 'No accounts match your search'
                : 'Create your first B2B wholesale account to get started'}
            </p>
            {!searchQuery && (
              <Link href="/retail-accounts/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Account
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
