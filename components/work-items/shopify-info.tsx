'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink, ShoppingBag, DollarSign, Tag, Package, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { formatDistanceToNow } from 'date-fns'

type WorkItem = Database['public']['Tables']['work_items']['Row']

interface ShopifyOrder {
  id: string
  order_number: string
  total_price: string
  financial_status: string
  fulfillment_status: string | null
  created_at: string
  line_items_count: number
}

interface ShopifyCustomer {
  id: string
  email: string
  first_name: string
  last_name: string
  orders_count: number
  total_spent: string
  tags: string
  created_at: string
}

export function ShopifyInfo({ workItem }: { workItem: WorkItem }) {
  const [shopifyData, setShopifyData] = useState<{
    customer: ShopifyCustomer | null
    orders: ShopifyOrder[]
    loading: boolean
  }>({
    customer: null,
    orders: [],
    loading: true,
  })

  useEffect(() => {
    async function fetchShopifyData() {
      if (!workItem.customer_email) {
        setShopifyData({ customer: null, orders: [], loading: false })
        return
      }

      try {
        // Fetch Shopify customer data
        const response = await fetch(
          `/api/shopify/lookup-customer?email=${encodeURIComponent(workItem.customer_email)}`
        )
        const data = await response.json()

        if (data.exists && data.customer) {
          setShopifyData({
            customer: data.customer,
            orders: data.orders || [],
            loading: false,
          })
        } else {
          setShopifyData({ customer: null, orders: [], loading: false })
        }
      } catch (error) {
        console.error('Failed to fetch Shopify data:', error)
        setShopifyData({ customer: null, orders: [], loading: false })
      }
    }

    fetchShopifyData()
  }, [workItem.customer_email])

  const getFinancialStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'refunded':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  const getFulfillmentStatusColor = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'

    switch (status.toLowerCase()) {
      case 'fulfilled':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'partial':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    }
  }

  if (shopifyData.loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Shopify Customer Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading Shopify data...</div>
        </CardContent>
      </Card>
    )
  }

  if (!shopifyData.customer) {
    // Check if we have Shopify order IDs stored but can't find customer
    const hasShopifyOrders = workItem.shopify_order_id || workItem.design_fee_order_id

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            Shopify Customer Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
            <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {hasShopifyOrders ? 'Customer Lookup Failed' : 'Not Connected to Shopify'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasShopifyOrders
                  ? `Can't find customer in Shopify by email. Orders may exist under a different email address.`
                  : `This customer doesn't exist in Shopify yet. An invoice will create them automatically.`
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const customerTags = shopifyData.customer.tags
    ? shopifyData.customer.tags.split(',').map(t => t.trim()).filter(Boolean)
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Shopify Customer Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Customer Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Total Spent
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${parseFloat(shopifyData.customer.total_spent).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              Total Orders
            </div>
            <div className="text-2xl font-bold">
              {shopifyData.customer.orders_count}
            </div>
          </div>
        </div>

        {/* Customer Tags */}
        {customerTags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Tag className="h-3 w-3" />
              Customer Tags
            </div>
            <div className="flex flex-wrap gap-2">
              {customerTags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Customer Since */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          Customer since {new Date(shopifyData.customer.created_at).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>

        {/* Order History */}
        {shopifyData.orders.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Order History</h4>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 h-7"
                onClick={() => {
                  const shopDomain = process.env.NEXT_PUBLIC_SHOPIFY_SHOP_DOMAIN || 'your-shop.myshopify.com'
                  window.open(
                    `https://${shopDomain}/admin/customers/${shopifyData.customer?.id}`,
                    '_blank'
                  )
                }}
              >
                View in Shopify
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            <div className="space-y-2">
              {shopifyData.orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="border rounded-lg p-3 space-y-2 bg-background hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        #{order.order_number}
                      </span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${parseFloat(order.total_price).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getFinancialStatusColor(order.financial_status)}>
                      {order.financial_status === 'paid' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {order.financial_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                      {order.financial_status}
                    </Badge>
                    {order.fulfillment_status && (
                      <Badge className={getFulfillmentStatusColor(order.fulfillment_status)}>
                        {order.fulfillment_status}
                      </Badge>
                    )}
                    {!order.fulfillment_status && (
                      <Badge variant="outline" className="text-xs">
                        Not Fulfilled
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {shopifyData.orders.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                Showing 5 of {shopifyData.orders.length} orders
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
