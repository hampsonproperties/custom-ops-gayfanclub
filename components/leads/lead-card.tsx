import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  Mail,
  Phone,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import type { Lead } from '@/lib/hooks/use-leads'

interface LeadCardProps {
  lead: Lead
}

const STATUS_CONFIG = {
  new_inquiry: {
    label: 'New Inquiry',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  info_sent: {
    label: 'Info Sent',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  },
  future_event_monitoring: {
    label: 'Future Event',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  design_fee_sent: {
    label: 'Design Fee Sent',
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  },
  design_fee_paid: {
    label: 'Design Fee Paid',
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  closed_won: {
    label: 'Won',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  },
  closed_lost: {
    label: 'Lost',
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
  closed_event_cancelled: {
    label: 'Event Cancelled',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  },
}

export function LeadCard({ lead }: LeadCardProps) {
  const statusConfig = STATUS_CONFIG[lead.status as keyof typeof STATUS_CONFIG] || {
    label: lead.status,
    color: 'bg-gray-100 text-gray-800',
  }

  const daysOld = lead.created_at
    ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const daysUntilEvent = lead.event_date
    ? Math.floor((new Date(lead.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header - Name & Value */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <Link href={`/work-items/${lead.id}`}>
                <h3 className="text-2xl font-bold hover:text-primary transition-colors truncate">
                  {lead.customer_name || lead.customer_email || 'Unknown Customer'}
                </h3>
              </Link>
              {lead.company_name && (
                <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Building2 className="h-4 w-4" />
                  {lead.company_name}
                </p>
              )}
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="h-3.5 w-3.5" />
                {lead.customer_email}
              </p>
              {lead.phone_number && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {lead.phone_number}
                </p>
              )}
            </div>

            {/* Value */}
            {lead.estimated_value && (
              <div className="text-right">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  ${lead.estimated_value.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Estimated</div>
              </div>
            )}
          </div>

          {/* Status & Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>

            {lead.shopify_customer_id && (
              <Badge variant="outline" className="gap-1">
                <ExternalLink className="h-3 w-3" />
                In Shopify
              </Badge>
            )}

            {lead.design_fee_order_id && (
              <Badge variant="outline" className="gap-1">
                <DollarSign className="h-3 w-3" />
                Design Fee Order
              </Badge>
            )}

            {daysUntilEvent !== null && (
              <Badge
                variant="outline"
                className={`gap-1 ${
                  daysUntilEvent < 14
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300'
                    : daysUntilEvent < 30
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300'
                    : ''
                }`}
              >
                <Calendar className="h-3 w-3" />
                Event in {daysUntilEvent}d
              </Badge>
            )}

            {lead.lead_source && (
              <Badge variant="secondary">{lead.lead_source}</Badge>
            )}
          </div>

          {/* Event Date */}
          {lead.event_date && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Event:</span>
              <span className="font-medium">
                {new Date(lead.event_date).toLocaleDateString()}
              </span>
              {daysUntilEvent !== null && daysUntilEvent < 30 && (
                <span className="text-muted-foreground">
                  ({daysUntilEvent}days away)
                </span>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
            <span>Created {daysOld}d ago</span>
            {lead.last_contact_at && (
              <span>
                Last contact{' '}
                {formatDistanceToNow(new Date(lead.last_contact_at), {
                  addSuffix: true,
                })}
              </span>
            )}
            {lead.assigned_to_email && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {lead.assigned_to_email}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Link href={`/work-items/${lead.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                View Details
              </Button>
            </Link>
            <Link href={`/work-items/${lead.id}#communications`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full gap-1.5">
                <Mail className="h-4 w-4" />
                Email
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
