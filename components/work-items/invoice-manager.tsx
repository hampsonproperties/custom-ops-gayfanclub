'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  ExternalLink,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy
} from 'lucide-react'
import { toast } from 'sonner'
import type { Database } from '@/types/database'

type WorkItem = Database['public']['Tables']['work_items']['Row'] & {
  estimated_value?: number | null
  actual_value?: number | null
}

interface InvoiceManagerProps {
  workItem: WorkItem
}

export function InvoiceManager({ workItem }: InvoiceManagerProps) {
  const [isCreatingDesignFee, setIsCreatingDesignFee] = useState(false)
  const [isCreatingProduction, setIsCreatingProduction] = useState(false)

  const handleCreateDesignFeeInvoice = async () => {
    setIsCreatingDesignFee(true)
    try {
      const response = await fetch(
        `/api/work-items/${workItem.id}/create-design-fee-invoice`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      toast.success('Design fee invoice created!', {
        description: `Invoice #${data.draftOrderNumber} created in Shopify`,
      })

      // Copy URL to clipboard
      if (data.invoiceUrl) {
        await navigator.clipboard.writeText(data.invoiceUrl)
        toast.info('Invoice URL copied to clipboard', {
          description: 'You can paste this link in your email to the customer',
        })
      }

      // Reload to show updated status
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice')
    } finally {
      setIsCreatingDesignFee(false)
    }
  }

  const handleCreateProductionInvoice = async () => {
    setIsCreatingProduction(true)
    try {
      const response = await fetch(
        `/api/work-items/${workItem.id}/create-production-invoice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: workItem.estimated_value,
            productTitle: 'Custom Fan Production',
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invoice')
      }

      toast.success('Production invoice created!', {
        description: `Invoice #${data.draftOrderNumber} created in Shopify`,
      })

      // Copy URL to clipboard
      if (data.invoiceUrl) {
        await navigator.clipboard.writeText(data.invoiceUrl)
        toast.info('Invoice URL copied to clipboard', {
          description: 'You can paste this link in your email to the customer',
        })
      }

      // Reload to show updated status
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice')
    } finally {
      setIsCreatingProduction(false)
    }
  }

  const copyInvoiceUrl = async (orderNumber: string, orderId: string, type: string) => {
    const url = `https://admin.shopify.com/store/gayfanclub/orders/${orderId}`
    await navigator.clipboard.writeText(url)
    toast.success(`${type} invoice link copied!`)
  }

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Shopify Invoices
            </CardTitle>
            <CardDescription>
              Create and manage invoices for this lead
            </CardDescription>
          </div>
          {!workItem.customer_email && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Email Required
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Design Fee Invoice Card */}
          <div className="relative border-2 rounded-lg p-5 space-y-4 bg-card hover:shadow-md transition-shadow">
            {workItem.design_fee_order_number && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Created
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-semibold text-base">Design Fee</h4>
              </div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                $250
              </div>
              <p className="text-xs text-muted-foreground">
                {workItem.design_fee_order_number
                  ? `Invoice #${workItem.design_fee_order_number}`
                  : 'Custom design mockup + 2 revisions'}
              </p>
            </div>

            {!workItem.design_fee_order_number ? (
              <Button
                onClick={handleCreateDesignFeeInvoice}
                disabled={isCreatingDesignFee || !workItem.customer_email}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="default"
              >
                {isCreatingDesignFee ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Create Design Fee Invoice
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <a
                  href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.design_fee_order_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full"
                >
                  <Button variant="outline" size="default" className="w-full gap-2">
                    <ExternalLink className="h-4 w-4" />
                    View in Shopify
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() =>
                    copyInvoiceUrl(
                      workItem.design_fee_order_number!,
                      workItem.design_fee_order_id!,
                      'Design fee'
                    )
                  }
                >
                  <Copy className="h-3 w-3" />
                  Copy Invoice Link
                </Button>
              </div>
            )}
          </div>

          {/* Production Invoice Card */}
          <div className="relative border-2 rounded-lg p-5 space-y-4 bg-card hover:shadow-md transition-shadow">
            {workItem.shopify_draft_order_id && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Created
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="font-semibold text-base">Production</h4>
              </div>
              {workItem.estimated_value ? (
                <>
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    ${workItem.estimated_value.toLocaleString()}
                  </div>
                  {workItem.design_fee_order_id && !workItem.shopify_draft_order_id && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Includes $250 design fee credit
                    </p>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground py-4">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Set estimated value first
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {workItem.shopify_draft_order_id
                  ? 'Production invoice sent'
                  : 'Final production order'}
              </p>
            </div>

            {!workItem.shopify_draft_order_id ? (
              <Button
                onClick={handleCreateProductionInvoice}
                disabled={
                  isCreatingProduction || !workItem.customer_email || !workItem.estimated_value
                }
                className="w-full bg-green-600 hover:bg-green-700"
                size="default"
              >
                {isCreatingProduction ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Create Production Invoice
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-2">
                <a
                  href={`https://admin.shopify.com/store/gayfanclub/orders/${workItem.shopify_draft_order_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block w-full"
                >
                  <Button variant="outline" size="default" className="w-full gap-2">
                    <ExternalLink className="h-4 w-4" />
                    View in Shopify
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() =>
                    copyInvoiceUrl(
                      'draft order',
                      workItem.shopify_draft_order_id!,
                      'Production'
                    )
                  }
                >
                  <Copy className="h-3 w-3" />
                  Copy Invoice Link
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex-shrink-0 mt-0.5">
            <div className="p-1.5 rounded-full bg-blue-100 dark:bg-blue-900">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-blue-900 dark:text-blue-100">
              How Shopify Invoices Work
            </p>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>Invoices are created as draft orders in Shopify</li>
              <li>Invoice URL is automatically copied to clipboard</li>
              <li>When customer pays, order automatically links to this lead</li>
              <li>Design fee credit applied automatically to production orders</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
