'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Palette,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Upload,
  Mail,
  Calendar,
  DollarSign,
  User
} from 'lucide-react'
import Link from 'next/link'
import { useWorkItems } from '@/lib/hooks/use-work-items'
import { formatDistanceToNow } from 'date-fns'

export default function DesignProjectsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('active')

  // Get work items assigned to current user
  const { data: myProjectsResult } = useWorkItems({
    assignedTo: 'me',
    type: 'assisted_project'
  })
  const myProjects = myProjectsResult?.items

  // Filter by design-related statuses
  const designStatuses = [
    'design_fee_paid',
    'design_in_progress',
    'proof_sent'
  ]

  const filteredProjects = myProjects?.filter(project => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        project.customer_name?.toLowerCase().includes(query) ||
        project.customer_email?.toLowerCase().includes(query) ||
        project.title?.toLowerCase().includes(query)

      if (!matchesSearch) return false
    }

    // Status filter
    if (statusFilter === 'active') {
      return designStatuses.includes(project.status)
    } else if (statusFilter === 'pending_approval') {
      return project.status === 'proof_sent'
    } else if (statusFilter === 'approved') {
      return project.status === 'approved'
    } else if (statusFilter === 'awaiting') {
      return project.status === 'design_fee_paid'
    }

    return true
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'design_fee_paid':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'design_in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'proof_sent':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'design_fee_paid':
        return <Clock className="h-4 w-4" />
      case 'design_in_progress':
        return <Palette className="h-4 w-4" />
      case 'proof_sent':
        return <AlertCircle className="h-4 w-4" />
      case 'approved':
        return <CheckCircle2 className="h-4 w-4" />
      default:
        return null
    }
  }

  const activeCount = myProjects?.filter(p => designStatuses.includes(p.status)).length || 0
  const awaitingCount = myProjects?.filter(p =>
    p.status === 'design_fee_paid'
  ).length || 0
  const pendingApprovalCount = myProjects?.filter(p =>
    p.status === 'proof_sent'
  ).length || 0
  const approvedCount = myProjects?.filter(p => p.status === 'approved').length || 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Palette className="h-8 w-8" />
          My Design Projects
        </h1>
        <p className="text-muted-foreground">Manage custom fan designs assigned to you</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Palette className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">In design workflow</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Design</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {awaitingCount}
            </div>
            <p className="text-xs text-muted-foreground">Need to start</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {pendingApprovalCount}
            </div>
            <p className="text-xs text-muted-foreground">Waiting for customer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {approvedCount}
            </div>
            <p className="text-xs text-muted-foreground">Ready for production</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
          <TabsList>
            <TabsTrigger value="active">All Active</TabsTrigger>
            <TabsTrigger value="awaiting">Awaiting Design</TabsTrigger>
            <TabsTrigger value="pending_approval">Pending Approval</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Projects Grid */}
      {filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            return (
              <Link key={project.id} href={`/work-items/${project.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xl truncate mb-1">
                          {project.customer_name || project.customer_email || 'Unknown Customer'}
                        </h3>
                        {project.customer_name && project.customer_email && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {project.customer_email}
                          </p>
                        )}
                      </div>
                      <Badge className={getStatusColor(project.status)} variant="secondary">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(project.status)}
                          <span className="capitalize">
                            {project.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">

                    {/* Action Needed Banner */}
                    {project.status === 'design_fee_paid' && (
                      <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-yellow-700 dark:text-yellow-300 font-medium">
                          Ready to start design
                        </span>
                      </div>
                    )}

                    {project.status === 'proof_sent' && (
                      <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-purple-700 dark:text-purple-300 font-medium">
                          Awaiting customer approval
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Projects Found</h3>
            <p className="text-muted-foreground text-center">
              {searchQuery
                ? 'No projects match your search'
                : statusFilter === 'active'
                ? 'You have no active design projects'
                : `No projects in ${statusFilter.replace('_', ' ')} status`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
