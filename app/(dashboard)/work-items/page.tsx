'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkItems } from '@/lib/hooks/use-work-items'
import { StatusBadge } from '@/components/custom/status-badge'
import { Search, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function WorkItemsPage() {
  const [search, setSearch] = useState('')
  const { data: workItems, isLoading } = useWorkItems({ search })

  if (isLoading) {
    return (
      <div className="p-6">
        <p>Loading work items...</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Work Items</h1>
          <p className="text-muted-foreground">
            {workItems?.length || 0} total work items
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, order #, or project..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Work Items Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-4 font-medium">Customer / Project</th>
                  <th className="text-left p-4 font-medium">Type</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Event Date</th>
                  <th className="text-left p-4 font-medium">Next Follow-Up</th>
                  <th className="text-left p-4 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {workItems && workItems.length > 0 ? (
                  workItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <Link href={`/work-items/${item.id}`} className="hover:underline">
                          <div>
                            <p className="font-medium">{item.customer_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">{item.title || item.customer_email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="text-sm capitalize">{item.type.replace('_', ' ')}</span>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="p-4">
                        <span className="text-sm">{item.event_date || '-'}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">
                          {item.next_follow_up_at
                            ? formatDistanceToNow(new Date(item.next_follow_up_at), { addSuffix: true })
                            : '-'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No work items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
