'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Download, CheckCircle2, XCircle, Palette, ClipboardCheck } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type ShopifyOrder = {
  id: number
  name: string
  email: string
  customerName: string | null
  financialStatus: string
  fulfillmentStatus: string | null
  totalPrice: string
  currency: string
  createdAt: string
  isCustom: boolean
  orderType: 'customify_order' | 'custom_design_service' | null
  previewUrl: string | null
  lineItemsCount: number
}

export default function ImportOrdersPage() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [orders, setOrders] = useState<ShopifyOrder[]>([])
  const [importingId, setImportingId] = useState<number | null>(null)
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set())

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter an order number or email address')
      return
    }

    setSearching(true)
    try {
      const res = await fetch('/api/shopify/search-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Search failed')
      }

      setOrders(data.orders || [])

      if (data.orders.length === 0) {
        toast.info('No orders found')
      } else {
        toast.success(`Found ${data.orders.length} order${data.orders.length > 1 ? 's' : ''}`)
      }
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  const handleImport = async (orderId: number) => {
    setImportingId(orderId)
    try {
      const res = await fetch('/api/shopify/import-single-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })

      const data = await res.json()

      if (res.status === 409) {
        toast.warning('Order already imported')
        setImportedIds(prev => new Set(prev).add(orderId))
        return
      }

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      toast.success(
        data.action === 'updated'
          ? 'Linked to existing work item!'
          : `Order imported! ${data.filesImported} files imported.`
      )

      setImportedIds(prev => new Set(prev).add(orderId))
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setImportingId(null)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Import Shopify Orders</h1>
        <p className="text-muted-foreground">
          Search for specific orders and import them into Custom Ops
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Shopify</CardTitle>
          <CardDescription>
            Search by order number (#6510) or customer email (customer@example.com)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter order number or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="h-4 w-4 mr-2" />
              {searching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {orders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Search Results</h2>
            <Badge variant="secondary">{orders.length} orders found</Badge>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {orders.map((order) => {
              const isImported = importedIds.has(order.id)
              const isImporting = importingId === order.id

              return (
                <Card key={order.id} className={isImported ? 'opacity-60' : ''}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        {/* Order Header */}
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">{order.name}</h3>
                          {order.isCustom ? (
                            <Badge
                              variant="secondary"
                              className={
                                order.orderType === 'custom_design_service'
                                  ? 'bg-[#E91E63]/10 text-[#E91E63]'
                                  : 'bg-[#9C27B0]/10 text-[#9C27B0]'
                              }
                            >
                              {order.orderType === 'custom_design_service' ? (
                                <>
                                  <Palette className="h-3 w-3 mr-1" />
                                  Custom Design Service
                                </>
                              ) : (
                                <>
                                  <ClipboardCheck className="h-3 w-3 mr-1" />
                                  Customify Order
                                </>
                              )}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              <XCircle className="h-3 w-3 mr-1" />
                              Not a custom order
                            </Badge>
                          )}
                          {isImported && (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Imported
                            </Badge>
                          )}
                        </div>

                        {/* Customer Info */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Customer:</span>{' '}
                            <span className="font-medium">{order.customerName || 'Unknown'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Email:</span>{' '}
                            <span className="font-medium">{order.email}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>{' '}
                            <span className="font-medium">
                              {order.currency} ${order.totalPrice}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>{' '}
                            <Badge variant="outline" className="ml-1">
                              {order.financialStatus}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>{' '}
                            <span className="font-medium">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Items:</span>{' '}
                            <span className="font-medium">{order.lineItemsCount}</span>
                          </div>
                        </div>

                        {/* Preview */}
                        {order.previewUrl && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>Has design preview available</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {order.isCustom && !isImported && (
                          <Button
                            onClick={() => handleImport(order.id)}
                            disabled={isImporting}
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            {isImporting ? 'Importing...' : 'Import Order'}
                          </Button>
                        )}
                        {!order.isCustom && (
                          <Button variant="outline" disabled className="gap-2">
                            <XCircle className="h-4 w-4" />
                            Not Custom
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Help Text */}
      {orders.length === 0 && !searching && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Search className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
            <div>
              <p className="text-lg font-medium">Search for Shopify Orders</p>
              <p className="text-sm text-muted-foreground mt-2">
                Enter an order number (e.g., #6510) or customer email to find matching orders
              </p>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Only Customify and Custom Design Service orders can be imported</p>
              <p>Orders already in Custom Ops will be marked as imported</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
