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
    <Card className="border-2 border-blue-300 dark:border-blue-700 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 border-b">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 rounded-lg bg-blue-600 text-white">
                <FileText className="h-5 w-5" />
              </div>
              Shopify Invoices
            </CardTitle>
            <CardDescription className="text-base">
              Create and send invoices directly from your CRM
            </CardDescription>
          </div>
          {!workItem.customer_email && (
            <Badge variant="destructive" className="gap-1 px-3 py-1">
              <AlertCircle className="h-4 w-4" />
              Email Required
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Design Fee Invoice Card */}
          <div className="relative border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6 space-y-4 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-background hover:shadow-xl transition-all hover:scale-[1.02]">
            {workItem.design_fee_order_number && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Created
                </Badge>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-600 shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Design Fee</h4>
                  <p className="text-xs text-muted-foreground">One-time charge</p>
                </div>
              </div>
              <div className="text-5xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
                $250
              </div>
              <p className="text-sm text-muted-foreground">
                {workItem.design_fee_order_number
                  ? `✓ Invoice #${workItem.design_fee_order_number}`
                  : '→ Custom design mockup + 2 revisions'}
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
          <div className="relative border-2 border-green-200 dark:border-green-800 rounded-xl p-6 space-y-4 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background hover:shadow-xl transition-all hover:scale-[1.02]">
            {workItem.shopify_draft_order_id && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Created
                </Badge>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-600 shadow-lg">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Production</h4>
                  <p className="text-xs text-muted-foreground">Final production order</p>
                </div>
              </div>
              {workItem.estimated_value ? (
                <>
                  <div className="text-5xl font-black text-green-600 dark:text-green-400 tracking-tight">
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
              <p className="text-sm text-muted-foreground">
                {workItem.shopify_draft_order_id
                  ? '✓ Production invoice sent'
                  : '→ Custom fan production'}
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
        <div className="flex items-start gap-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-2 border-blue-200 dark:border-blue-700 rounded-xl shadow-sm">
          <div className="flex-shrink-0">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="space-y-2 flex-1">
            <p className="font-bold text-base text-blue-900 dark:text-blue-100">
              💡 How Shopify Invoices Work
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1.5 list-none">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                <span>Invoices are created as draft orders in Shopify</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                <span>Invoice URL is automatically copied to clipboard</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                <span>When customer pays, order automatically links to this lead</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
                <span>Design fee credit applied automatically to production orders</span>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
