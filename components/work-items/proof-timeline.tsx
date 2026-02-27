'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useFiles } from '@/lib/hooks/use-files'
import { useUpdateWorkItem } from '@/lib/hooks/use-work-items'
import {
  CheckCircle2,
  XCircle,
  Upload,
  Download,
  Eye,
  AlertTriangle,
  Clock,
  MessageSquare,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { toast } from 'sonner'

interface ProofTimelineProps {
  workItemId: string
  revisionCount?: number
  customerFeedback?: string | null
  onFeedbackUpdate?: (feedback: string) => void
}

export function ProofTimeline({
  workItemId,
  revisionCount = 0,
  customerFeedback,
  onFeedbackUpdate,
}: ProofTimelineProps) {
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackText, setFeedbackText] = useState(customerFeedback || '')
  const [selectedProof, setSelectedProof] = useState<any>(null)

  const { data: files, isLoading } = useFiles(workItemId)
  const updateWorkItem = useUpdateWorkItem()

  // Filter for proof files only and sort by version
  const proofFiles = (files || [])
    .filter((file) => file.kind === 'proof')
    .sort((a, b) => (b.version || 0) - (a.version || 0))

  const handleSaveFeedback = async () => {
    if (!onFeedbackUpdate) return

    try {
      await updateWorkItem.mutateAsync({
        id: workItemId,
        updates: {
          customer_feedback: feedbackText,
        },
      })
      onFeedbackUpdate(feedbackText)
      toast.success('Feedback saved')
      setShowFeedbackDialog(false)
    } catch (error) {
      toast.error('Failed to save feedback')
    }
  }

  const handleDownload = (file: any) => {
    // Download file logic
    toast.success(`Downloading ${file.original_filename}`)
    // TODO: Implement actual download logic
  }

  const handleView = (file: any) => {
    setSelectedProof(file)
    // TODO: Implement file viewer
    toast.info('File viewer not yet implemented')
  }

  const getVersionBadge = (version: number) => {
    if (version === 1) {
      return <Badge variant="outline">Original</Badge>
    }
    return <Badge variant="secondary">Revision {version - 1}</Badge>
  }

  const getStatusIcon = (file: any) => {
    // Determine status based on work item state or file metadata
    // For now, use simple logic
    if (file.version === 1 && proofFiles.length > 1) {
      return <XCircle className="h-5 w-5 text-red-500" />
    }
    return <Clock className="h-5 w-5 text-yellow-500" />
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Loading proof timeline...
      </div>
    )
  }

  if (proofFiles.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Proofs Yet</h3>
          <p className="text-sm text-muted-foreground">
            Upload the first proof to start the approval process
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Revision Warning */}
      {revisionCount >= 3 && (
        <Card className="border-2 border-yellow-500">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
              <div>
                <div className="font-semibold text-yellow-700">
                  High Revision Count
                </div>
                <div className="text-sm text-muted-foreground">
                  This project has {revisionCount} revisions. Consider reviewing requirements with the customer.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Feedback Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Customer Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customerFeedback ? (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded-lg text-sm">
                {customerFeedback}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFeedbackText(customerFeedback)
                  setShowFeedbackDialog(true)
                }}
              >
                Update Feedback
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">
                No customer feedback recorded yet
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFeedbackDialog(true)}
              >
                Add Feedback
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proof Timeline */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Proof History</h3>

        <div className="relative space-y-6">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

          {proofFiles.map((file, index) => (
            <Card key={file.id} className="relative ml-14">
              {/* Timeline Dot */}
              <div className="absolute -left-14 top-6 flex items-center justify-center w-12 h-12 rounded-full bg-background border-2 border-border">
                {getStatusIcon(file)}
              </div>

              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getVersionBadge(file.version || 1)}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(file.created_at), 'MMM d, yyyy')}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({formatDistanceToNow(new Date(file.created_at), { addSuffix: true })})
                      </span>
                    </div>
                    <div className="font-medium">{file.original_filename}</div>
                    {file.note && (
                      <div className="text-sm text-muted-foreground">
                        Note: {file.note}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {file.size_bytes
                      ? `${(file.size_bytes / 1024 / 1024).toFixed(2)} MB`
                      : ''}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleView(file)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(file)}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  {index === 0 && (
                    <Badge className="ml-auto">Latest Version</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Customer Feedback</DialogTitle>
            <DialogDescription>
              Record customer comments and feedback on the proof
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Enter customer feedback..."
              rows={6}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowFeedbackDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveFeedback}
                disabled={updateWorkItem.isPending}
              >
                {updateWorkItem.isPending ? 'Saving...' : 'Save Feedback'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
