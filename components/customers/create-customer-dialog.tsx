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

const log = logger('create-customer-dialog')

interface CreateCustomerDialogProps {
  trigger?: React.ReactNode
  defaultOpen?: boolean
  onCustomerCreated?: (customerId: string) => void
}

export function CreateCustomerDialog({
  trigger,
  defaultOpen = false,
  onCustomerCreated
}: CreateCustomerDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [isCreating, setIsCreating] = useState(false)

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    organization_name: '',
    assigned_to_user_id: '',
    sales_stage: 'new_lead',
  })

  // Fetch users for assignment dropdown
  const { data: users } = useQuery({
    queryKey: ['users-for-assignment'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .order('full_name')

      if (error) throw error
      return data
    },
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email.trim()) {
      toast.error('Email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsCreating(true)

    try {
      const supabase = createClient()

      // Check if customer with this email already exists
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', formData.email.toLowerCase().trim())
        .single()

      if (existing) {
        toast.error('A customer with this email already exists')
        setIsCreating(false)
        return
      }

      // Create customer
      const customerData: any = {
        email: formData.email.toLowerCase().trim(),
        sales_stage: formData.sales_stage,
      }

      if (formData.first_name.trim()) {
        customerData.first_name = formData.first_name.trim()
      }

      if (formData.last_name.trim()) {
        customerData.last_name = formData.last_name.trim()
      }

      if (formData.phone.trim()) {
        customerData.phone = formData.phone.trim()
      }

      if (formData.organization_name.trim()) {
        customerData.organization_name = formData.organization_name.trim()
      }

      if (formData.assigned_to_user_id) {
        customerData.assigned_to_user_id = formData.assigned_to_user_id
      }

      // Generate display_name if we have first/last name
      if (formData.first_name.trim() || formData.last_name.trim()) {
        customerData.display_name = `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim()
      }

      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert(customerData)
        .select()
        .single()

      if (error) {
        log.error('Error creating customer', { error })
        throw new Error(error.message)
      }

      toast.success('Customer created successfully')
      setOpen(false)

      // Reset form
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        organization_name: '',
        assigned_to_user_id: '',
        sales_stage: 'new_lead',
      })

      // Call callback or navigate
      if (onCustomerCreated) {
        onCustomerCreated(newCustomer.id)
      } else {
        router.push(`/customers/${newCustomer.id}`)
      }

    } catch (error: any) {
      log.error('Create customer error', { error })
      toast.error(error.message || 'Failed to create customer')
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
            New Customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Customer</DialogTitle>
          <DialogDescription>
            Add a new customer to your CRM system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>

            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                placeholder="John"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
              />
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                placeholder="Smith"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>

            {/* Organization */}
            <div className="space-y-2">
              <Label htmlFor="organization_name">Company / Organization</Label>
              <Input
                id="organization_name"
                placeholder="Acme Corp"
                value={formData.organization_name}
                onChange={(e) => handleChange('organization_name', e.target.value)}
              />
            </div>

            {/* Assigned To */}
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Assign To</Label>
              <Select
                value={formData.assigned_to_user_id}
                onValueChange={(value) => handleChange('assigned_to_user_id', value)}
              >
                <SelectTrigger id="assigned_to">
                  <SelectValue placeholder="Select team member (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sales Stage */}
            <div className="space-y-2">
              <Label htmlFor="sales_stage">Initial Sales Stage</Label>
              <Select
                value={formData.sales_stage}
                onValueChange={(value) => handleChange('sales_stage', value)}
              >
                <SelectTrigger id="sales_stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_lead">New Lead</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="in_discussion">In Discussion</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="negotiating">Negotiating</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="active_customer">Active Customer</SelectItem>
                </SelectContent>
              </Select>
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
            <Button type="submit" disabled={isCreating}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
