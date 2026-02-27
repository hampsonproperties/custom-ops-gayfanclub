'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useWorkItems } from '@/lib/hooks/use-work-items'
import { StatusBadge } from '@/components/custom/status-badge'
import { Search, Filter, LayoutList, LayoutGrid, Mail, Phone, MoreHorizontal, Building2, DollarSign } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function WorkItemsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const { data: workItems, isLoading } = useWorkItems({ search: debouncedSearch })

  // Calculate stats
  const activeLeads = workItems?.filter(item => !item.closed_at).length || 0
  const totalValue = workItems?.reduce((sum, item) => {
    const value = (item as any).estimated_value || 0
    return sum + value
  }, 0) || 0

  // Helper function to get initials
  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const parts = name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.substring(0, 2).toUpperCase()
    }
    return '??'
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading work items...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sales Leads</h1>
          <p className="text-muted-foreground">
            Manage your customer projects and opportunities
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeLeads}</div>
            <p className="text-xs text-muted-foreground">Active Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Pipeline Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, company..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-11 sm:h-9"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 flex-1 sm:flex-none h-11 sm:h-9">
                <Filter className="h-4 w-4" />
                <span className="sm:inline">Filters</span>
              </Button>
              <div className="hidden sm:flex border rounded-md">
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="rounded-r-none"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'pipeline' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('pipeline')}
                  className="rounded-l-none"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            {/* Desktop Table View - Hidden on mobile */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b bg-muted/20">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">Name</th>
                    <th className="text-left p-3 font-medium text-sm">Company</th>
                    <th className="text-left p-3 font-medium text-sm">Email</th>
                    <th className="text-left p-3 font-medium text-sm">Phone</th>
                    <th className="text-left p-3 font-medium text-sm">Est. Value</th>
                    <th className="text-left p-3 font-medium text-sm">Next Follow-Up</th>
                    <th className="text-right p-3 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workItems && workItems.length > 0 ? (
                    workItems.map((item) => {
                      const extendedItem = item as any
                      return (
                        <tr key={item.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3">
                            <Link href={`/work-items/${item.id}`}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className="text-xs bg-primary/10">
                                    {getInitials(item.customer_name, item.customer_email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm hover:underline">
                                    {item.customer_name || item.customer_email || 'Unknown'}
                                  </p>
                                  <div className="mt-0.5">
                                    <StatusBadge status={item.status} />
                                  </div>
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              {extendedItem.company_name ? (
                                <>
                                  <Building2 className="h-3.5 w-3.5" />
                                  {extendedItem.company_name}
                                </>
                              ) : (
                                <span className="text-muted-foreground/50">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {item.customer_email || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {extendedItem.phone_number || '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            {extendedItem.estimated_value ? (
                              <div className="flex items-center gap-1.5 text-sm font-medium">
                                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                {extendedItem.estimated_value.toLocaleString()}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground/50">-</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground">
                              {item.next_follow_up_at
                                ? formatDistanceToNow(new Date(item.next_follow_up_at), { addSuffix: true })
                                : '-'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                asChild
                              >
                                <a href={`mailto:${item.customer_email}`}>
                                  <Mail className="h-4 w-4" />
                                </a>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/work-items/${item.id}`}>View Details</Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>Change Status</DropdownMenuItem>
                                  <DropdownMenuItem>Send Email</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No leads found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Shown on mobile only */}
            <div className="md:hidden p-3 space-y-3">
              {workItems && workItems.length > 0 ? (
                workItems.map((item) => {
                  const extendedItem = item as any
                  return (
                    <Link key={item.id} href={`/work-items/${item.id}`}>
                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-12 w-12 shrink-0">
                              <AvatarFallback className="text-sm bg-gradient-to-br from-pink-500 to-purple-600 text-white">
                                {getInitials(item.customer_name, item.customer_email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-base mb-1">
                                {item.customer_name || item.customer_email || 'Unknown'}
                              </div>
                              <div className="mb-2">
                                <StatusBadge status={item.status} />
                              </div>

                              <div className="space-y-1.5 text-sm text-muted-foreground">
                                {extendedItem.company_name && (
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5" />
                                    <span className="truncate">{extendedItem.company_name}</span>
                                  </div>
                                )}
                                {item.customer_email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="truncate">{item.customer_email}</span>
                                  </div>
                                )}
                                {extendedItem.phone_number && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5" />
                                    <span>{extendedItem.phone_number}</span>
                                  </div>
                                )}
                                {extendedItem.estimated_value && (
                                  <div className="flex items-center gap-2 font-medium text-foreground">
                                    <DollarSign className="h-3.5 w-3.5" />
                                    <span>${extendedItem.estimated_value.toLocaleString()}</span>
                                  </div>
                                )}
                              </div>

                              {item.next_follow_up_at && (
                                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                                  Follow up {formatDistanceToNow(new Date(item.next_follow_up_at), { addSuffix: true })}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No leads found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline View - Placeholder */}
      {viewMode === 'pipeline' && (
        <Card>
          <CardContent className="p-12 text-center">
            <LayoutGrid className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Pipeline View Coming Soon</h3>
            <p className="text-sm text-muted-foreground">
              Kanban board view will be implemented next
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
