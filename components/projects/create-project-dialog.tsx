'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { logger } from '@/lib/logger'

const log = logger('create-project-dialog')

interface CreateProjectDialogProps {
  trigger?: React.ReactNode
  customerId?: string
  onProjectCreated?: (projectId: string) => void
}

export function CreateProjectDialog({
  trigger,
  customerId: initialCustomerId,
  onProjectCreated
}: CreateProjectDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const [formData, setFormData] = useState({
    customer_id: initialCustomerId || '',
    title: '',
    type: 'custom_merch',
    status: 'new_inquiry',
    event_date: '',
    notes: '',
  })

  // Fetch customers for dropdown (if not pre-filled)
  const { data: customers } = useQuery({
    queryKey: ['customers-for-project'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customers')
        .select('id, display_name, first_name, last_name, email')
        .order('display_name')

      if (error) throw error
      return data
    },
    enabled: !initialCustomerId, // Only fetch if customer not pre-selected
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.customer_id) {
      toast.error('Please select a customer')
      return
    }

    setIsCreating(true)

    try {
      const supabase = createClient()

      // Create project
      const projectData: any = {
        customer_id: formData.customer_id,
        type: formData.type,
        status: formData.status,
      }

      if (formData.title.trim()) {
        projectData.title = formData.title.trim()
      }

      if (formData.event_date) {
        projectData.event_date = formData.event_date
      }

      const { data: newProject, error } = await supabase
        .from('work_items')
        .insert(projectData)
        .select()
        .single()

      if (error) {
        log.error('Error creating project', { error })
        throw new Error(error.message)
      }

      // If there are notes, create an initial note
      if (formData.notes.trim()) {
        const { data: { user } } = await supabase.auth.getUser()

        await supabase
          .from('activity_logs')
          .insert({
            activity_type: 'note_added',
            related_entity_type: 'work_item',
            related_entity_id: newProject.id,
            customer_id: formData.customer_id,
            user_id: user?.id,
            metadata: {
              note: formData.notes.trim(),
              context: 'project_created'
            }
          })
      }

      toast.success('Project created successfully')
      setOpen(false)

      // Reset form
      setFormData({
        customer_id: initialCustomerId || '',
        title: '',
        type: 'custom_merch',
        status: 'new_inquiry',
        event_date: '',
        notes: '',
      })

      // Call callback or navigate
      if (onProjectCreated) {
        onProjectCreated(newProject.id)
      } else {
        router.push(`/customers/${formData.customer_id}/projects/${newProject.id}`)
      }

    } catch (error: any) {
      log.error('Create project error', { error })
      toast.error(error.message || 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project for a customer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Customer Selection (if not pre-filled) */}
            {!initialCustomerId && (
              <div className="space-y-2">
                <Label htmlFor="customer">Customer *</Label>
                <Select
                  value={formData.customer_id}
                  onValueChange={(value) => handleChange('customer_id', value)}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.display_name ||
                         `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
                         customer.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Project Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Project Title (Optional)</Label>
              <Input
                id="title"
                placeholder="e.g., PTA Fundraiser 2026"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use order number as title
              </p>
            </div>

            {/* Project Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Project Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleChange('type', value)}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom_merch">Custom Merchandise</SelectItem>
                  <SelectItem value="fan_gear">Fan Gear</SelectItem>
                  <SelectItem value="event_merch">Event Merchandise</SelectItem>
                  <SelectItem value="corporate_gifts">Corporate Gifts</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Event Date */}
            <div className="space-y-2">
              <Label htmlFor="event_date">Event Date (Optional)</Label>
              <Input
                id="event_date"
                type="date"
                value={formData.event_date}
                onChange={(e) => handleChange('event_date', e.target.value)}
              />
            </div>

            {/* Initial Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Initial Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_inquiry">New Inquiry</SelectItem>
                  <SelectItem value="awaiting_approval">Awaiting Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="in_design">In Design</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Initial Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Initial Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any initial notes about this project..."
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !formData.customer_id}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
