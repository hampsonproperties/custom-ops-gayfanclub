'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCustomerContacts,
  useAddCustomerContact,
  useUpdateCustomerContact,
  useDeleteCustomerContact,
  type CustomerContact,
} from '@/lib/hooks/use-customer-contacts'
import { Plus, Mail, Phone, User, Trash2, Edit, Star, Receipt } from 'lucide-react'
import { toast } from 'sonner'

const CONTACT_ROLES = [
  'Financial Sponsor',
  'Co-Chair',
  'Decision Maker',
  'Coordinator',
  'Admin Assistant',
  'Board Member',
  'Other',
]

interface AlternativeContactsManagerProps {
  customerId: string
}

export function AlternativeContactsManager({ customerId }: AlternativeContactsManagerProps) {
  const { data: contacts, isLoading } = useCustomerContacts(customerId)
  const addContact = useAddCustomerContact()
  const updateContact = useUpdateCustomerContact()
  const deleteContact = useDeleteCustomerContact()

  const [showDialog, setShowDialog] = useState(false)
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: '',
    title: '',
    is_primary: false,
    receives_emails: true,
    receives_invoices: false,
    notes: '',
  })

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      role: '',
      title: '',
      is_primary: false,
      receives_emails: true,
      receives_invoices: false,
      notes: '',
    })
    setEditingContact(null)
  }

  const handleAdd = () => {
    setShowDialog(true)
    resetForm()
  }

  const handleEdit = (contact: CustomerContact) => {
    setEditingContact(contact)
    setFormData({
      full_name: contact.full_name,
      email: contact.email || '',
      phone: contact.phone || '',
      role: contact.role || '',
      title: contact.title || '',
      is_primary: contact.is_primary,
      receives_emails: contact.receives_emails,
      receives_invoices: contact.receives_invoices,
      notes: contact.notes || '',
    })
    setShowDialog(true)
  }

  const handleSave = async () => {
    if (!formData.full_name.trim()) {
      toast.error('Name is required')
      return
    }

    try {
      if (editingContact) {
        await updateContact.mutateAsync({
          id: editingContact.id,
          customerId,
          updates: formData,
        })
        toast.success('Contact updated')
      } else {
        await addContact.mutateAsync({
          customer_id: customerId,
          ...formData,
        })
        toast.success('Contact added')
      }
      setShowDialog(false)
      resetForm()
    } catch (error) {
      toast.error('Failed to save contact')
    }
  }

  const handleDelete = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return

    try {
      await deleteContact.mutateAsync({ id: contactId, customerId })
      toast.success('Contact deleted')
    } catch (error) {
      toast.error('Failed to delete contact')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Alternative Contacts</CardTitle>
            <CardDescription>
              Sponsors, co-chairs, decision makers, and other key contacts
            </CardDescription>
          </div>
          <Button onClick={handleAdd} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground">Loading contacts...</div>
        ) : !contacts || contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No alternative contacts yet</p>
            <p className="text-sm mt-1">Add sponsors, co-chairs, or other key contacts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-start justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{contact.full_name}</span>
                    {contact.is_primary && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3" />
                        Primary
                      </Badge>
                    )}
                    {contact.role && (
                      <Badge variant="outline" className="text-xs">
                        {contact.role}
                      </Badge>
                    )}
                  </div>

                  {contact.title && (
                    <p className="text-sm text-muted-foreground">{contact.title}</p>
                  )}

                  <div className="flex flex-wrap gap-3 mt-2 text-sm">
                    {contact.email && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        <span>{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-2">
                    {contact.receives_emails && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Mail className="h-3 w-3" />
                        CC on emails
                      </Badge>
                    )}
                    {contact.receives_invoices && (
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Receipt className="h-3 w-3" />
                        Gets invoices
                      </Badge>
                    )}
                  </div>

                  {contact.notes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {contact.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleEdit(contact)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(contact.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Edit Contact' : 'Add Alternative Contact'}
            </DialogTitle>
            <DialogDescription>
              Add sponsors, co-chairs, decision makers, or other key contacts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="PTA President"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this contact..."
                  rows={3}
                />
              </div>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_primary"
                  checked={formData.is_primary}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_primary: !!checked })}
                />
                <label htmlFor="is_primary" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Primary contact for this customer
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="receives_emails"
                  checked={formData.receives_emails}
                  onCheckedChange={(checked) => setFormData({ ...formData, receives_emails: !!checked })}
                />
                <label htmlFor="receives_emails" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  CC this contact on customer emails
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="receives_invoices"
                  checked={formData.receives_invoices}
                  onCheckedChange={(checked) => setFormData({ ...formData, receives_invoices: !!checked })}
                />
                <label htmlFor="receives_invoices" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Send invoices to this contact
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.full_name.trim()}>
              {editingContact ? 'Update Contact' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
