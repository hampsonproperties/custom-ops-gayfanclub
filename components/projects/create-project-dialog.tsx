'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
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
import { Loader2, Plus, ChevronsUpDown, Check, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { logger } from '@/lib/logger'

const log = logger('create-project-dialog')

interface CreateProjectDialogProps {
  trigger?: React.ReactNode
  defaultOpen?: boolean
  customerId?: string
  onProjectCreated?: (projectId: string) => void
}

export function CreateProjectDialog({
  trigger,
  defaultOpen = false,
  customerId: initialCustomerId,
  onProjectCreated
}: CreateProjectDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [isCreating, setIsCreating] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerList, setShowCustomerList] = useState(false)
  const customerSearchRef = useRef<HTMLInputElement>(null)

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

  const getCustomerLabel = (c: { display_name: string | null; first_name: string | null; last_name: string | null; email: string }) =>
    c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email

  const filteredCustomers = useMemo(() => {
    if (!customers) return []
    if (!customerSearch.trim()) return customers
    const q = customerSearch.toLowerCase()
    return customers.filter((c) => {
      const label = getCustomerLabel(c).toLowerCase()
      return label.includes(q) || c.email.toLowerCase().includes(q)
    })
  }, [customers, customerSearch])

  const selectedCustomer = customers?.find((c) => c.id === formData.customer_id)

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
                <Label>Customer *</Label>
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={customerSearchRef}
                      placeholder={selectedCustomer ? getCustomerLabel(selectedCustomer) : 'Search customers...'}
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value)
                        setShowCustomerList(true)
                      }}
                      onFocus={() => setShowCustomerList(true)}
                      className={`pl-9 ${selectedCustomer && !customerSearch ? 'text-foreground' : ''}`}
                    />
                  </div>
                  {showCustomerList && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowCustomerList(false)} />
                      <div className="absolute left-0 right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        {filteredCustomers.length === 0 ? (
                          <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                            No customers found
                          </div>
                        ) : (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-2 ${
                                formData.customer_id === customer.id ? 'bg-accent' : ''
                              }`}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                handleChange('customer_id', customer.id)
                                setCustomerSearch('')
                                setShowCustomerList(false)
                              }}
                            >
                              {formData.customer_id === customer.id && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-sm truncate">{getCustomerLabel(customer)}</div>
                                <div className="text-xs text-muted-foreground truncate">{customer.email}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
                {selectedCustomer && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {getCustomerLabel(selectedCustomer)} ({selectedCustomer.email})
                  </p>
                )}
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
