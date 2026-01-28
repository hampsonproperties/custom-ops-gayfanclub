'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  useFollowUpToday,
  useOverdueFollowUps,
  useDesignReviewQueue,
  useReadyForBatch
} from '@/lib/hooks/use-work-items'
import { useUntriagedEmails } from '@/lib/hooks/use-communications'
import { ArrowRight, AlertCircle, Clock, ClipboardCheck, Mail, Package } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: followUpToday } = useFollowUpToday()
  const { data: overdueFollowUps } = useOverdueFollowUps()
  const { data: designReviewQueue } = useDesignReviewQueue()
  const { data: readyForBatch } = useReadyForBatch()
  const { data: untriagedEmails } = useUntriagedEmails()

  const stats = [
    {
      title: 'Needs Follow-Up Today',
      count: followUpToday?.length || 0,
      icon: Clock,
      link: '/work-items?view=follow-up-today',
      color: 'text-[#FFC107]',
      bgColor: 'bg-[#FFC107]/10'
    },
    {
      title: 'Overdue Follow-Ups',
      count: overdueFollowUps?.length || 0,
      icon: AlertCircle,
      link: '/work-items?view=overdue',
      color: 'text-[#E91E63]',
      bgColor: 'bg-[#E91E63]/10'
    },
    {
      title: 'Design Review Queue',
      count: designReviewQueue?.length || 0,
      icon: ClipboardCheck,
      link: '/design-queue',
      color: 'text-[#9C27B0]',
      bgColor: 'bg-[#9C27B0]/10'
    },
    {
      title: 'Untriaged Emails',
      count: untriagedEmails?.length || 0,
      icon: Mail,
      link: '/email-intake',
      color: 'text-[#00BCD4]',
      bgColor: 'bg-[#00BCD4]/10'
    },
    {
      title: 'Ready for Batch',
      count: readyForBatch?.length || 0,
      icon: Package,
      link: '/batches',
      color: 'text-[#4CAF50]',
      bgColor: 'bg-[#4CAF50]/10'
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">What needs attention right now?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} href={stat.link}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline justify-between">
                    <div className="text-3xl font-bold">{stat.count}</div>
                    <Button variant="ghost" size="sm" className="gap-1">
                      View <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Link href="/email-intake">
            <Button className="gap-2">
              <Mail className="h-4 w-4" />
              Triage Emails
            </Button>
          </Link>
          <Link href="/design-queue">
            <Button variant="secondary" className="gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Review Designs
            </Button>
          </Link>
          <Link href="/batches">
            <Button variant="outline" className="gap-2">
              <Package className="h-4 w-4" />
              Create Batch
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
