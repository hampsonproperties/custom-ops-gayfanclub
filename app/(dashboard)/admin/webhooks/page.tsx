'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, AlertCircle, CheckCircle2, Clock, XCircle, SkipForward } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

type WebhookEvent = {
  id: string
  provider: string
  event_type: string
  external_event_id: string
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  processing_error?: string
  created_at: string
  processed_at?: string
  retry_count: number
  last_retry_at?: string
  payload: any
}

export default function WebhooksAdminPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhook_events', selectedStatus],
    queryFn: async () => {
      let query = supabase
        .from('webhook_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (selectedStatus !== 'all') {
        query = query.eq('processing_status', selectedStatus)
      }

      const { data, error } = await query

      if (error) throw error
      return data as WebhookEvent[]
    },
  })

  const reprocessWebhook = useMutation({
    mutationFn: async (webhookId: string) => {
      // Call webhook reprocessing endpoint
      const response = await fetch('/api/webhooks/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Reprocessing failed')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook_events'] })
      toast.success('Webhook reprocessed successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to reprocess: ${error.message}`)
    },
  })

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-gray-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-500',
      failed: 'bg-red-500',
      processing: 'bg-blue-500',
      pending: 'bg-yellow-500',
      skipped: 'bg-gray-500',
    }

    return (
      <Badge className={`${colors[status as keyof typeof colors]} text-white`}>
        {status}
      </Badge>
    )
  }

  const counts = {
    all: webhooks.length,
    failed: webhooks.filter(w => w.processing_status === 'failed').length,
    pending: webhooks.filter(w => w.processing_status === 'pending').length,
    processing: webhooks.filter(w => w.processing_status === 'processing').length,
  }

  if (isLoading) {
    return <div className="p-6">Loading webhooks...</div>
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Management</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and reprocess failed Shopify webhooks
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['webhook_events'] })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        <Button
          variant={selectedStatus === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedStatus('all')}
        >
          All ({counts.all})
        </Button>
        <Button
          variant={selectedStatus === 'failed' ? 'default' : 'outline'}
          onClick={() => setSelectedStatus('failed')}
        >
          <XCircle className="h-4 w-4 mr-2" />
          Failed ({counts.failed})
        </Button>
        <Button
          variant={selectedStatus === 'pending' ? 'default' : 'outline'}
          onClick={() => setSelectedStatus('pending')}
        >
          <AlertCircle className="h-4 w-4 mr-2" />
          Pending ({counts.pending})
        </Button>
        <Button
          variant={selectedStatus === 'processing' ? 'default' : 'outline'}
          onClick={() => setSelectedStatus('processing')}
        >
          <Clock className="h-4 w-4 mr-2" />
          Processing ({counts.processing})
        </Button>
      </div>

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No webhooks found</h3>
                <p className="text-muted-foreground">
                  {selectedStatus === 'failed'
                    ? 'No failed webhooks to reprocess'
                    : 'Webhook events will appear here as they are received'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(webhook.processing_status)}
                      <CardTitle className="text-lg">{webhook.event_type}</CardTitle>
                      {getStatusBadge(webhook.processing_status)}
                    </div>
                    <CardDescription className="flex items-center gap-4">
                      <span>Provider: {webhook.provider}</span>
                      <span>Event ID: {webhook.external_event_id}</span>
                      <span>
                        {formatDistanceToNow(new Date(webhook.created_at), { addSuffix: true })}
                      </span>
                    </CardDescription>
                  </div>
                  {webhook.processing_status === 'failed' && (
                    <Button
                      size="sm"
                      onClick={() => reprocessWebhook.mutate(webhook.id)}
                      disabled={reprocessWebhook.isPending}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reprocess
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {webhook.processing_error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <p className="font-medium text-red-900">Error:</p>
                      <p className="text-red-700">{webhook.processing_error}</p>
                    </div>
                  )}
                  {webhook.retry_count > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <RefreshCw className="h-3 w-3" />
                      <span>Retried {webhook.retry_count} time(s)</span>
                      {webhook.last_retry_at && (
                        <span>
                          · Last retry{' '}
                          {formatDistanceToNow(new Date(webhook.last_retry_at), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>
                  )}
                  {webhook.processed_at && (
                    <div className="text-muted-foreground">
                      Processed{' '}
                      {formatDistanceToNow(new Date(webhook.processed_at), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
