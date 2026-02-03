'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RainbowHeader } from '@/components/custom/rainbow-header'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle } from 'lucide-react'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'

function RequestChangesContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!token) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!feedback.trim()) {
      toast.error('Please provide feedback about the changes you need')
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch('/api/request-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          feedback: feedback.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.error === 'Token has expired') {
          router.push('/approve-proof?error=token_expired')
          return
        }
        if (result.error === 'Token has already been used') {
          router.push('/approve-proof?error=token_used')
          return
        }
        throw new Error(result.error || 'Failed to submit changes request')
      }

      // Redirect to success page
      router.push(
        `/approve-proof?success=true&action=reject&workItemId=${result.workItemId}`
      )
    } catch (error) {
      console.error('Failed to submit changes request:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to submit changes request'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <RainbowHeader />
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">
              Request Design Changes
            </CardTitle>
            <CardDescription className="text-center">
              Please let us know what changes you'd like to see in your design.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="feedback" className="text-sm font-medium block mb-2">
                  What changes would you like?
                </label>
                <Textarea
                  id="feedback"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Please describe the changes you'd like to see in your design. Be as specific as possible (e.g., 'Change the background color to blue', 'Make the text larger', 'Remove the logo from the bottom', etc.)"
                  rows={8}
                  className="resize-none"
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Our design team will review your feedback and send you an updated proof
                  shortly.
                </p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  💡 <strong>Tip:</strong> The more specific you are about the changes you want,
                  the faster we can get you an updated design!
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.history.back()}
                  disabled={submitting}
                >
                  Go Back
                </Button>
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Changes Request'}
                </Button>
              </div>

              <div className="pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground">
                  Need to talk to us directly? Email{' '}
                  <a
                    href="mailto:sales@thegayfanclub.com"
                    className="text-primary hover:underline"
                  >
                    sales@thegayfanclub.com
                  </a>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function RequestChangesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <RequestChangesContent />
    </Suspense>
  )
}
