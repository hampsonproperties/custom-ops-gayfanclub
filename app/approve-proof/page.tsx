'use client'

import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RainbowHeader } from '@/components/custom/rainbow-header'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Suspense } from 'react'

function ApprovalContent() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success') === 'true'
  const action = searchParams.get('action')
  const workItemId = searchParams.get('workItemId')
  const error = searchParams.get('error')

  if (error) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <RainbowHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-4">
                <AlertCircle className="h-16 w-16 text-destructive" />
              </div>
              <CardTitle className="text-2xl font-bold text-center">
                Oops! Something went wrong
              </CardTitle>
              <CardDescription className="text-center">
                {error === 'token_expired' && 'This approval link has expired.'}
                {error === 'token_used' && 'This approval link has already been used.'}
                {error === 'invalid_token' && 'This approval link is invalid.'}
                {!['token_expired', 'token_used', 'invalid_token'].includes(error) && error}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Please contact us at{' '}
                <a
                  href="mailto:sales@thegayfanclub.com"
                  className="text-primary hover:underline"
                >
                  sales@thegayfanclub.com
                </a>{' '}
                if you need assistance.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!success || !action) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <RainbowHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-4">
                <AlertCircle className="h-16 w-16 text-yellow-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-center">
                Invalid Request
              </CardTitle>
              <CardDescription className="text-center">
                This page requires a valid approval link.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  const isApproved = action === 'approve'

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <RainbowHeader />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              {isApproved ? (
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              ) : (
                <XCircle className="h-16 w-16 text-orange-500" />
              )}
            </div>
            <CardTitle className="text-2xl font-bold text-center">
              {isApproved ? 'Design Approved!' : 'Changes Requested'}
            </CardTitle>
            <CardDescription className="text-center">
              {isApproved
                ? 'Thank you for approving your design.'
                : 'We received your request for changes.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isApproved ? (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200">
                  Your custom fans will now move into production! You'll receive a shipping
                  notification once your order is on its way.
                </p>
              </div>
            ) : (
              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  Our design team will review your feedback and send you an updated proof
                  shortly. Please keep an eye on your email for the revised design.
                </p>
              </div>
            )}

            <div className="pt-4 border-t text-center">
              <p className="text-sm text-muted-foreground">
                Have questions? Contact us at{' '}
                <a
                  href="mailto:sales@thegayfanclub.com"
                  className="text-primary hover:underline"
                >
                  sales@thegayfanclub.com
                </a>
              </p>
            </div>

            {workItemId && (
              <div className="text-xs text-muted-foreground text-center pt-2">
                Reference ID: {workItemId.slice(0, 8)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ApproveProofPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <ApprovalContent />
    </Suspense>
  )
}
