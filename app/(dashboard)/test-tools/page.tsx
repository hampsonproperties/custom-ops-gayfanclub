'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Beaker, Trash2, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function TestToolsPage() {
  const [email, setEmail] = useState('timothy@hampsonproperties.com')
  const [creating, setCreating] = useState(false)
  const [lastCreatedOrder, setLastCreatedOrder] = useState<{
    id: string
    customer_name: string
    customer_email: string
    shopify_order_number: string
  } | null>(null)

  const handleCreateTestOrder = async () => {
    if (!email) {
      toast.error('Please enter an email address')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/create-test-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create test order')
      }

      setLastCreatedOrder(result.workItem)
      toast.success('Test order created successfully!')
    } catch (error) {
      console.error('Failed to create test order:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to create test order'
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Beaker className="h-8 w-8 text-purple-600" />
        <div>
          <h1 className="text-3xl font-bold">Test Tools</h1>
          <p className="text-muted-foreground">
            Developer tools for testing features safely
          </p>
        </div>
      </div>

      {/* Create Test Order */}
      <Card>
        <CardHeader>
          <CardTitle>Create Test Customify Order</CardTitle>
          <CardDescription>
            Create a test order with sample files to safely test the approval email
            feature without sending emails to real customers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-email">Your Email Address</Label>
            <Input
              id="test-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Test approval emails will be sent to this address
            </p>
          </div>

          <Button
            onClick={handleCreateTestOrder}
            disabled={creating || !email}
            className="gap-2"
          >
            <Beaker className="h-4 w-4" />
            {creating ? 'Creating Test Order...' : 'Create Test Order'}
          </Button>

          {lastCreatedOrder && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200 font-semibold">
                <CheckCircle className="h-5 w-5" />
                Test Order Created!
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <strong>Order #:</strong> {lastCreatedOrder.shopify_order_number}
                </p>
                <p>
                  <strong>Customer:</strong> {lastCreatedOrder.customer_name}
                </p>
                <p>
                  <strong>Email:</strong> {lastCreatedOrder.customer_email}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/work-items/${lastCreatedOrder.id}`}>
                  <Button variant="outline" size="sm">
                    View Order
                  </Button>
                </Link>
                <Link href={`/work-items/${lastCreatedOrder.id}#files`}>
                  <Button variant="outline" size="sm">
                    Test Approval Email
                  </Button>
                </Link>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>What gets created:</strong>
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 list-disc list-inside mt-2 space-y-1">
              <li>A Customify order marked as "TEST ORDER - Safe to Delete"</li>
              <li>4 sample files: preview, design, other, and proof</li>
              <li>Order number: TEST-[timestamp]</li>
              <li>Status: In Progress</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test Approval Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <p className="font-medium">Create a test order above</p>
                <p className="text-sm text-muted-foreground">
                  Click "Create Test Order" to generate sample data
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <p className="font-medium">Go to the test order's Files tab</p>
                <p className="text-sm text-muted-foreground">
                  Click "View Order" or navigate to Work Items
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <p className="font-medium">Click "Send Approval Email"</p>
                <p className="text-sm text-muted-foreground">
                  You'll see all 4 sample files available to select
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                4
              </div>
              <div>
                <p className="font-medium">Select a file and preview the email</p>
                <p className="text-sm text-muted-foreground">
                  Click "Show Preview" to see what the customer will receive
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                5
              </div>
              <div>
                <p className="font-medium">Send the test email</p>
                <p className="text-sm text-muted-foreground">
                  The email will be sent to your email address (safe to test!)
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                6
              </div>
              <div>
                <p className="font-medium">Delete the test order when done</p>
                <p className="text-sm text-muted-foreground">
                  Test orders are clearly marked and safe to delete
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Trash2 className="h-5 w-5" />
            Cleaning Up Test Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Test orders are marked with "🧪 TEST ORDER - Safe to Delete" in the title.
            You can safely delete them from the work items list when you're done testing.
            All associated files and timeline events will be automatically deleted.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
