'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useDataHealth,
  useRecalculateAggregates,
  useRelinkOrders,
  useRelinkEmails,
  useBulkShopifyLink,
  useBackfillFiles,
  type DataHealthDiagnostics,
} from '@/lib/hooks/use-data-health'
import { toast } from 'sonner'
import {
  Loader2,
  Activity,
  ShoppingCart,
  Mail,
  Users,
  Link2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Calculator,
  Database,
} from 'lucide-react'

interface DiagnosticItemProps {
  label: string
  count: number
  icon: React.ReactNode
  description: string
  fixLabel?: string
  onFix?: () => void
  isFixing?: boolean
  fixResult?: string | null
}

function DiagnosticItem({ label, count, icon, description, fixLabel, onFix, isFixing, fixResult }: DiagnosticItemProps) {
  const color = count === 0
    ? 'text-green-700 bg-green-50 border-green-200'
    : count <= 5
    ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200'

  const iconColor = count === 0 ? 'text-green-600' : count <= 5 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b last:border-b-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`mt-0.5 ${iconColor}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{label}</span>
            <Badge variant="outline" className={color}>
              {count}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {fixResult && (
            <p className="text-xs text-green-600 mt-1">{fixResult}</p>
          )}
        </div>
      </div>
      {onFix && count > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onFix}
          disabled={isFixing}
          className="shrink-0"
        >
          {isFixing ? (
            <><Loader2 className="h-3 w-3 animate-spin mr-1" />Fixing...</>
          ) : (
            <>{fixLabel || 'Fix'}</>
          )}
        </Button>
      )}
    </div>
  )
}

export function DataHealthSection() {
  const { data, refetch, isFetching } = useDataHealth()
  const recalculate = useRecalculateAggregates()
  const relinkOrders = useRelinkOrders()
  const relinkEmails = useRelinkEmails()
  const bulkLink = useBulkShopifyLink()
  const backfillFiles = useBackfillFiles()

  const [fixResults, setFixResults] = useState<Record<string, string>>({})
  const [hasRun, setHasRun] = useState(false)

  const diagnostics = data?.diagnostics

  const handleRunDiagnostics = async () => {
    setFixResults({})
    const result = await refetch()
    setHasRun(true)
    if (result.error) {
      toast.error('Failed to run diagnostics: ' + result.error.message)
    } else {
      toast.success('Diagnostics complete')
    }
  }

  const handleRecalculate = () => {
    recalculate.mutate(undefined, {
      onSuccess: (data) => {
        setFixResults(prev => ({ ...prev, aggregates: `Recalculated ${data.recalculated} customers` }))
        toast.success(`Recalculated aggregates for ${data.recalculated} customers`)
        refetch()
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const handleRelinkOrders = () => {
    relinkOrders.mutate(undefined, {
      onSuccess: (data) => {
        setFixResults(prev => ({ ...prev, orders: `Re-linked ${data.relinked} of ${data.total_orphaned} orphaned orders` }))
        toast.success(`Re-linked ${data.relinked} of ${data.total_orphaned} orders`)
        refetch()
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const handleRelinkEmails = () => {
    relinkEmails.mutate(undefined, {
      onSuccess: (data) => {
        setFixResults(prev => ({ ...prev, emails: `Linked ${data.linked} of ${data.total_unlinked} emails` }))
        toast.success(`Linked ${data.linked} of ${data.total_unlinked} emails`)
        refetch()
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const handleBulkLink = () => {
    bulkLink.mutate(undefined, {
      onSuccess: (data) => {
        setFixResults(prev => ({ ...prev, shopify: `Linked ${data.linked} of ${data.total} customers` }))
        toast.success(`Linked ${data.linked} of ${data.total} customers to Shopify`)
        refetch()
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const totalIssues = diagnostics
    ? diagnostics.unlinked_shopify +
      diagnostics.aggregate_mismatches +
      diagnostics.duplicate_customers +
      diagnostics.orphaned_orders +
      diagnostics.unlinked_communications +
      diagnostics.orphaned_work_items +
      diagnostics.dlq_failed
    : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Data Health</CardTitle>
          </div>
          {hasRun && diagnostics && (
            <Badge variant="outline" className={
              totalIssues === 0
                ? 'bg-green-50 text-green-700 border-green-200'
                : totalIssues <= 10
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-red-50 text-red-700 border-red-200'
            }>
              {totalIssues === 0 ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />All Clear</>
              ) : (
                <><AlertTriangle className="h-3 w-3 mr-1" />{totalIssues} Issues</>
              )}
            </Badge>
          )}
        </div>
        <CardDescription>
          Check your data for missing links, stale totals, and orphaned records. Run diagnostics to see the current state, then use the fix tools to repair issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-4">
          <Button
            onClick={handleRunDiagnostics}
            disabled={isFetching}
            variant={hasRun ? 'outline' : 'default'}
          >
            {isFetching ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Running Diagnostics...</>
            ) : hasRun ? (
              <><RefreshCw className="h-4 w-4 mr-2" />Re-run Diagnostics</>
            ) : (
              <><Activity className="h-4 w-4 mr-2" />Run Diagnostics</>
            )}
          </Button>
          {data?.timestamp && (
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {new Date(data.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {diagnostics && (
          <div className="border rounded-lg px-4">
            <DiagnosticItem
              label="Missing Shopify Link"
              count={diagnostics.unlinked_shopify}
              icon={<Link2 className="h-4 w-4" />}
              description="Customers with email but no Shopify customer ID"
              fixLabel="Link to Shopify"
              onFix={handleBulkLink}
              isFixing={bulkLink.isPending}
              fixResult={fixResults.shopify}
            />
            <DiagnosticItem
              label="Aggregate Mismatches"
              count={diagnostics.aggregate_mismatches}
              icon={<Calculator className="h-4 w-4" />}
              description="Customers where stored total doesn't match actual order sum"
              fixLabel="Recalculate"
              onFix={handleRecalculate}
              isFixing={recalculate.isPending}
              fixResult={fixResults.aggregates}
            />
            <DiagnosticItem
              label="Duplicate Customers"
              count={diagnostics.duplicate_customers}
              icon={<Users className="h-4 w-4" />}
              description="Email addresses shared by multiple customer records"
            />
            <DiagnosticItem
              label="Orphaned Orders"
              count={diagnostics.orphaned_orders}
              icon={<ShoppingCart className="h-4 w-4" />}
              description="Orders not linked to any customer"
              fixLabel="Re-link"
              onFix={handleRelinkOrders}
              isFixing={relinkOrders.isPending}
              fixResult={fixResults.orders}
            />
            <DiagnosticItem
              label="Unlinked Emails"
              count={diagnostics.unlinked_communications}
              icon={<Mail className="h-4 w-4" />}
              description="Emails not linked to any customer"
              fixLabel="Re-link"
              onFix={handleRelinkEmails}
              isFixing={relinkEmails.isPending}
              fixResult={fixResults.emails}
            />
            <DiagnosticItem
              label="Orphaned Work Items"
              count={diagnostics.orphaned_work_items}
              icon={<AlertTriangle className="h-4 w-4" />}
              description="Open work items with no customer assigned"
            />
            <DiagnosticItem
              label="Failed DLQ Items"
              count={diagnostics.dlq_failed}
              icon={<AlertTriangle className="h-4 w-4" />}
              description="Dead letter queue items that failed all retries"
            />
          </div>
        )}

        {/* Customify File Backfill */}
        <div className="mt-4 p-4 border rounded-lg bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Re-import Design Files from Customify</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Replace old Shopify-parsed files with clean, labeled files from the Customify API
              </p>
              {fixResults.backfill && (
                <p className="text-xs text-green-600 mt-1">{fixResults.backfill}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                backfillFiles.mutate({ dryRun: false }, {
                  onSuccess: (data) => {
                    setFixResults(prev => ({ ...prev, backfill: `Updated ${data.updated} orders, ${data.no_customify_data} not in Customify, ${data.failed} failed` }))
                    toast.success(`Backfilled files for ${data.updated} orders`)
                  },
                  onError: (err) => toast.error(err.message),
                })
              }}
              disabled={backfillFiles.isPending}
              className="shrink-0"
            >
              {backfillFiles.isPending ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" />Importing...</>
              ) : (
                <>Re-import Files</>
              )}
            </Button>
          </div>
        </div>

        {diagnostics && diagnostics.aggregate_mismatches > 0 && diagnostics.aggregate_details.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Largest mismatches (sample):</p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium">Customer</th>
                    <th className="px-3 py-1.5 text-right font-medium">Stored</th>
                    <th className="px-3 py-1.5 text-right font-medium">Actual</th>
                    <th className="px-3 py-1.5 text-right font-medium">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnostics.aggregate_details.slice(0, 5).map((item) => (
                    <tr key={item.customer_id} className="border-t">
                      <td className="px-3 py-1.5">{item.display_name || item.email || 'Unknown'}</td>
                      <td className="px-3 py-1.5 text-right">${Number(item.stored_total).toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-right">${Number(item.actual_total).toFixed(2)}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${Number(item.difference) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Number(item.difference) > 0 ? '+' : ''}${Number(item.difference).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {diagnostics && diagnostics.duplicate_customers > 0 && diagnostics.duplicate_details.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Duplicate emails found:</p>
            <div className="flex flex-wrap gap-2">
              {diagnostics.duplicate_details.slice(0, 5).map((d) => (
                <Badge key={d.email} variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">
                  {d.email} ({d.count} records)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {data?.errors && data.errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs font-medium text-red-700 mb-1">Some checks had errors:</p>
            {data.errors.map((err, i) => (
              <p key={i} className="text-xs text-red-600">{err}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
