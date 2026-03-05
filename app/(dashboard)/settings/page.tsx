'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useFollowUpCadences,
  useUpdateFollowUpCadence,
  type FollowUpCadence,
} from '@/lib/hooks/use-follow-up-cadences'
import {
  useAllQuickReplyTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type QuickReplyTemplate,
} from '@/lib/hooks/use-templates'
import { toast } from 'sonner'
import {
  Loader2, Check, Clock, Pause, CalendarDays,
  Plus, Pencil, Trash2, FileText, Mail,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════
// Follow-Up Rules Section (unchanged from previous build)
// ═══════════════════════════════════════════════════════════════════

const STATUS_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  info_sent: 'Info Sent',
  future_event_monitoring: 'Future Event',
  design_fee_sent: 'Design Fee Sent',
  design_fee_paid: 'Design Fee Paid',
  in_design: 'In Design',
  proof_sent: 'Proof Sent',
  awaiting_approval: 'Awaiting Approval',
  invoice_sent: 'Invoice Sent',
  paid_ready_for_batch: 'Paid — Ready for Batch',
  closed_won: 'Closed (Won)',
  closed_lost: 'Closed (Lost)',
  closed_event_cancelled: 'Closed (Cancelled)',
  needs_design_review: 'Needs Design Review',
  needs_customer_fix: 'Needs Customer Fix',
  approved: 'Approved',
  ready_for_batch: 'Ready for Batch',
  batched: 'Batched',
  shipped: 'Shipped',
  closed: 'Closed',
}

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function getEventRangeLabel(cadence: FollowUpCadence): string | null {
  const min = cadence.days_until_event_min
  const max = cadence.days_until_event_max
  if (min === null && max === null) return null
  if (min === 0 && max !== null) return `< ${max} days to event`
  if (min !== null && max !== null) return `${min}–${max} days to event`
  if (min !== null && max === null) return `${min}+ days to event`
  return null
}

function CadenceRow({ cadence }: { cadence: FollowUpCadence }) {
  const updateCadence = useUpdateFollowUpCadence()
  const [editingDays, setEditingDays] = useState(false)
  const [daysValue, setDaysValue] = useState(String(cadence.follow_up_days))

  const isPaused = cadence.pauses_follow_up ?? false
  const isActive = cadence.is_active ?? true
  const businessDays = cadence.business_days_only ?? false
  const eventRange = getEventRangeLabel(cadence)

  const handleToggle = (field: 'is_active' | 'business_days_only' | 'pauses_follow_up', value: boolean) => {
    updateCadence.mutate(
      { id: cadence.id, updates: { [field]: value } },
      {
        onSuccess: () => toast.success(`Updated "${cadence.name}"`),
        onError: () => toast.error('Failed to update rule'),
      }
    )
  }

  const handleSaveDays = () => {
    const num = parseInt(daysValue, 10)
    if (isNaN(num) || num < 1) {
      toast.error('Follow-up days must be at least 1')
      setDaysValue(String(cadence.follow_up_days))
      setEditingDays(false)
      return
    }
    updateCadence.mutate(
      { id: cadence.id, updates: { follow_up_days: num } },
      {
        onSuccess: () => {
          toast.success(`Updated "${cadence.name}" to ${num} days`)
          setEditingDays(false)
        },
        onError: () => toast.error('Failed to update interval'),
      }
    )
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border ${!isActive ? 'opacity-50 bg-muted/30' : ''}`}>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{getStatusLabel(cadence.status)}</span>
          {eventRange && (
            <Badge variant="outline" className="text-xs font-normal">
              <CalendarDays className="h-3 w-3 mr-1" />
              {eventRange}
            </Badge>
          )}
          {isPaused && (
            <Badge variant="secondary" className="text-xs">
              <Pause className="h-3 w-3 mr-1" />
              Paused
            </Badge>
          )}
        </div>
        {cadence.description && (
          <p className="text-xs text-muted-foreground truncate">{cadence.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isPaused ? (
          <span className="text-xs text-muted-foreground w-24 text-center">No follow-up</span>
        ) : editingDays ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              value={daysValue}
              onChange={(e) => setDaysValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveDays()
                if (e.key === 'Escape') { setEditingDays(false); setDaysValue(String(cadence.follow_up_days)) }
              }}
              className="w-16 h-8 text-center text-sm"
              autoFocus
            />
            <span className="text-xs text-muted-foreground">days</span>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSaveDays} disabled={updateCadence.isPending}>
              {updateCadence.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-sm font-mono"
            onClick={() => setEditingDays(true)}
            disabled={!isActive}
          >
            <Clock className="h-3 w-3" />
            {cadence.follow_up_days}d
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-1.5">
          <Switch
            id={`biz-${cadence.id}`}
            checked={businessDays}
            onCheckedChange={(v) => handleToggle('business_days_only', v)}
            disabled={!isActive || isPaused}
            className="scale-75"
          />
          <Label htmlFor={`biz-${cadence.id}`} className="text-xs text-muted-foreground cursor-pointer">
            Biz days
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch
            id={`active-${cadence.id}`}
            checked={isActive}
            onCheckedChange={(v) => handleToggle('is_active', v)}
            className="scale-75"
          />
          <Label htmlFor={`active-${cadence.id}`} className="text-xs text-muted-foreground cursor-pointer">
            Active
          </Label>
        </div>
      </div>
    </div>
  )
}

function FollowUpRulesSection() {
  const { data: cadences, isLoading, error } = useFollowUpCadences()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Follow-Up Rules</CardTitle>
          <CardDescription>Loading cadence rules...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Follow-Up Rules</CardTitle>
          <CardDescription className="text-destructive">Failed to load cadence rules</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const assistedCadences = cadences?.filter((c) => c.work_item_type === 'assisted_project') ?? []
  const customifyCadences = cadences?.filter((c) => c.work_item_type === 'customify_order') ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Follow-Up Rules — Assisted Projects</CardTitle>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              {assistedCadences.length} rules
            </Badge>
          </div>
          <CardDescription>
            How often to follow up with customers at each stage. Click the interval to edit. Paused rules mean no customer follow-up is needed (internal work stages).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {assistedCadences.map((c) => (
            <CadenceRow key={c.id} cadence={c} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Follow-Up Rules — Customify Orders</CardTitle>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {customifyCadences.length} rules
            </Badge>
          </div>
          <CardDescription>
            Follow-up cadences for Shopify Customify orders. Most production stages are paused since the customer doesn't need to act.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {customifyCadences.map((c) => (
            <CadenceRow key={c.id} cadence={c} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Email Templates Section
// ═══════════════════════════════════════════════════════════════════

const TEMPLATE_CATEGORIES = [
  { value: 'lead', label: 'Sales & Leads', color: 'bg-blue-100 text-blue-800' },
  { value: 'design', label: 'Design', color: 'bg-purple-100 text-purple-800' },
  { value: 'production', label: 'Production', color: 'bg-green-100 text-green-800' },
  { value: 'support', label: 'Support', color: 'bg-orange-100 text-orange-800' },
  { value: 'general', label: 'General', color: 'bg-gray-100 text-gray-800' },
]

function getCategoryColor(category: string | null) {
  return TEMPLATE_CATEGORIES.find((c) => c.value === category)?.color || 'bg-gray-100 text-gray-800'
}

function getCategoryLabel(category: string | null) {
  return TEMPLATE_CATEGORIES.find((c) => c.value === category)?.label || category || 'Uncategorized'
}

interface TemplateFormData {
  name: string
  key: string
  category: string
  description: string
  subject_template: string
  body_html_template: string
}

const emptyForm: TemplateFormData = {
  name: '',
  key: '',
  category: 'general',
  description: '',
  subject_template: '',
  body_html_template: '',
}

function generateKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function TemplateFormDialog({
  open,
  onOpenChange,
  editingTemplate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTemplate: QuickReplyTemplate | null
}) {
  const createTemplate = useCreateTemplate()
  const updateTemplate = useUpdateTemplate()
  const isEditing = !!editingTemplate

  const [form, setForm] = useState<TemplateFormData>(
    editingTemplate
      ? {
          name: editingTemplate.name,
          key: editingTemplate.key,
          category: editingTemplate.category || 'general',
          description: editingTemplate.description || '',
          subject_template: editingTemplate.subject_template || '',
          body_html_template: editingTemplate.body_html_template,
        }
      : emptyForm
  )

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast.error('Template name is required')
      return
    }
    if (!form.body_html_template.trim()) {
      toast.error('Template body is required')
      return
    }

    const key = form.key.trim() || generateKey(form.name)

    if (isEditing) {
      updateTemplate.mutate(
        {
          id: editingTemplate.id,
          updates: {
            name: form.name.trim(),
            key,
            category: form.category,
            description: form.description.trim() || null,
            subject_template: form.subject_template.trim() || null,
            body_html_template: form.body_html_template.trim(),
          },
        },
        {
          onSuccess: () => {
            toast.success(`Template "${form.name}" updated`)
            onOpenChange(false)
          },
          onError: () => toast.error('Failed to update template'),
        }
      )
    } else {
      createTemplate.mutate(
        {
          name: form.name.trim(),
          key,
          category: form.category,
          description: form.description.trim() || null,
          subject_template: form.subject_template.trim() || null,
          body_html_template: form.body_html_template.trim(),
        },
        {
          onSuccess: () => {
            toast.success(`Template "${form.name}" created`)
            onOpenChange(false)
          },
          onError: () => toast.error('Failed to create template'),
        }
      )
    }
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Template' : 'New Template'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update this email template. Changes appear immediately in the email composer.'
              : 'Create a new email template. It will appear in the email composer right away.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Name *</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Initial Response"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value, key: isEditing ? form.key : generateKey(e.target.value) })
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-category">Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Description (optional)</Label>
            <Input
              id="tpl-desc"
              placeholder="Short description of when to use this template"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-subject">Subject Line</Label>
            <Input
              id="tpl-subject"
              placeholder="e.g. Re: Custom Fan Order"
              value={form.subject_template}
              onChange={(e) => setForm({ ...form, subject_template: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-body">Body *</Label>
            <Textarea
              id="tpl-body"
              rows={12}
              placeholder="Type the email body here. Use [PLACEHOLDER] for values staff will fill in."
              value={form.body_html_template}
              onChange={(e) => setForm({ ...form, body_html_template: e.target.value })}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use [PLACEHOLDER] syntax for values like [INVOICE_LINK], [DATE], [TRACKING_NUMBER].
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />{isEditing ? 'Saving...' : 'Creating...'}</>
            ) : (
              isEditing ? 'Save Changes' : 'Create Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EmailTemplatesSection() {
  const { data: templates, isLoading, error } = useAllQuickReplyTemplates()
  const deleteTemplate = useDeleteTemplate()
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<QuickReplyTemplate | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription>Loading templates...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Templates</CardTitle>
          <CardDescription className="text-destructive">Failed to load templates</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const activeTemplates = templates?.filter((t) => t.is_active !== false) ?? []

  // Group by category
  const grouped = TEMPLATE_CATEGORIES.map((cat) => ({
    ...cat,
    templates: activeTemplates.filter((t) => t.category === cat.value),
  })).filter((g) => g.templates.length > 0)

  // Templates without a recognized category
  const uncategorized = activeTemplates.filter(
    (t) => !TEMPLATE_CATEGORIES.some((c) => c.value === t.category)
  )
  if (uncategorized.length > 0) {
    grouped.push({ value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800', templates: uncategorized })
  }

  const handleEdit = (template: QuickReplyTemplate) => {
    setEditingTemplate(template)
    setShowForm(true)
  }

  const handleDelete = (id: string) => {
    deleteTemplate.mutate(id, {
      onSuccess: () => {
        toast.success('Template removed')
        setConfirmDelete(null)
      },
      onError: () => toast.error('Failed to remove template'),
    })
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Templates
              </CardTitle>
              <CardDescription className="mt-1">
                Templates staff can use when composing emails. Changes appear instantly in the email composer.
              </CardDescription>
            </div>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => { setEditingTemplate(null); setShowForm(true) }}
            >
              <Plus className="h-4 w-4" />
              Add Template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeTemplates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No templates yet. Create your first template to get started.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group) => (
                <div key={group.value}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={group.color} variant="secondary">
                      {group.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{group.templates.length} template{group.templates.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {group.templates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{template.name}</span>
                            {(template.use_count ?? 0) > 0 && (
                              <span className="text-xs text-muted-foreground">
                                used {template.use_count}x
                              </span>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                          )}
                          {template.subject_template && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono truncate">
                              Subject: {template.subject_template}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(template)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {confirmDelete === template.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs px-2"
                                onClick={() => handleDelete(template.id)}
                                disabled={deleteTemplate.isPending}
                              >
                                {deleteTemplate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs px-2"
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => setConfirmDelete(template.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <TemplateFormDialog
          open={showForm}
          onOpenChange={(open) => {
            setShowForm(open)
            if (!open) setEditingTemplate(null)
          }}
          editingTemplate={editingTemplate}
        />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Settings Page
// ═══════════════════════════════════════════════════════════════════

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage templates, integrations, and system configuration</p>
      </div>

      {/* Integration status cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Shopify Integration</CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Connected</Badge>
            </div>
            <CardDescription>Shopify webhook and API are configured via environment variables</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Microsoft 365</CardTitle>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Connected</Badge>
            </div>
            <CardDescription>Email sending and receiving are configured via environment variables</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Email Templates — full section */}
      <EmailTemplatesSection />

      {/* Follow-Up Rules — full section */}
      <FollowUpRulesSection />
    </div>
  )
}
