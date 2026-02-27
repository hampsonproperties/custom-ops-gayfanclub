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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <FileText className="h-5 w-5" />
              Shopify Invoices
            </CardTitle>
            <CardDescription>
              Create and send invoices directly from your CRM
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
          <div className="relative border rounded-lg p-4 space-y-3">
            {workItem.design_fee_order_number && (
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  Created
                </Badge>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-600">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Design Fee</h4>
                <p className="text-sm text-muted-foreground">One-time charge</p>
              </div>
            </div>

            <div className="text-4xl font-bold">$250</div>

            <p className="text-sm text-muted-foreground">
              {workItem.design_fee_order_number
                ? `Invoice #${workItem.design_fee_order_number}`
                : 'Custom design mockup + 2 revisions'}
            </p>

            {!workItem.design_fee_order_number ? (
              <Button
                onClick={handleCreateDesignFeeInvoice}
                disabled={isCreatingDesignFee || !workItem.customer_email}
                className="w-full"
              >
                {isCreatingDesignFee ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
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
                  <Button variant="outline" size="sm" className="w-full gap-2">
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
          <div className="relative border rounded-lg p-4 space-y-3">
            {workItem.shopify_draft_order_id && (
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  Created
                </Badge>
              </div>
            )}

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-green-600">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">Production</h4>
                <p className="text-sm text-muted-foreground">Final production order</p>
              </div>
            </div>

            {workItem.estimated_value ? (
              <>
                <div className="text-4xl font-bold">
                  ${workItem.estimated_value.toLocaleString()}
                </div>
                {workItem.design_fee_order_id && !workItem.shopify_draft_order_id && (
                  <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Includes $250 design fee credit
                  </p>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground py-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Set estimated value first
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              {workItem.shopify_draft_order_id
                ? 'Production invoice sent'
                : 'Custom fan production'}
            </p>

            {!workItem.shopify_draft_order_id ? (
              <Button
                onClick={handleCreateProductionInvoice}
                disabled={
                  isCreatingProduction || !workItem.customer_email || !workItem.estimated_value
                }
                className="w-full"
              >
                {isCreatingProduction ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
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
                  <Button variant="outline" size="sm" className="w-full gap-2">
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

        {/* Info Section */}
        <div className="border-t pt-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium text-sm">How Shopify Invoices Work</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Invoices are created as draft orders in Shopify</li>
                <li>• Invoice URL is automatically copied to clipboard</li>
                <li>• When customer pays, order automatically links to this lead</li>
                <li>• Design fee credit applied automatically to production orders</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
