'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUpdateWorkItem } from '@/lib/hooks/use-work-items'
import { Edit2, Check, X, Plus, Trash2, Building2, Phone, Globe, MapPin, Users } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

type WorkItem = any

interface SecondaryContact {
  name: string
  email: string
  phone?: string
  role?: string
}

export function CustomerDetailsEditor({ workItem }: { workItem: WorkItem }) {
  const updateWorkItem = useUpdateWorkItem()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Resolve customer data: prefer joined customer, fall back to work item fields
  const customer = workItem.customer
  const resolvedName = customer?.display_name || workItem.customer_name || ''
  const resolvedEmail = customer?.email || workItem.customer_email || ''
  const resolvedCompany = customer?.organization_name || workItem.company_name || ''
  const resolvedPhone = customer?.phone || workItem.phone_number || ''

  const [formData, setFormData] = useState({
    customer_name: resolvedName,
    customer_email: resolvedEmail,
    company_name: resolvedCompany,
    phone_number: resolvedPhone,
    address: workItem.address || '',
    website: workItem.website || '',
    lead_source: workItem.lead_source || '',
    industry: workItem.industry || '',
    company_size: workItem.company_size || '',
  })
  const [secondaryContacts, setSecondaryContacts] = useState<SecondaryContact[]>(
    workItem.secondary_contacts || []
  )

  // Keep form data in sync when workItem changes
  useEffect(() => {
    const c = workItem.customer
    setFormData({
      customer_name: c?.display_name || workItem.customer_name || '',
      customer_email: c?.email || workItem.customer_email || '',
      company_name: c?.organization_name || workItem.company_name || '',
      phone_number: c?.phone || workItem.phone_number || '',
      address: workItem.address || '',
      website: workItem.website || '',
      lead_source: workItem.lead_source || '',
      industry: workItem.industry || '',
      company_size: workItem.company_size || '',
    })
  }, [workItem])

  const handleSave = async () => {
    try {
      setIsSaving(true)

      // If work item has a linked customer, update the customer record
      if (workItem.customer_id) {
        const supabase = createClient()

        // Parse name into first/last
        const nameParts = formData.customer_name.trim().split(/\s+/)
        const firstName = nameParts[0] || null
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null

        const { error: customerError } = await supabase
          .from('customers')
          .update({
            display_name: formData.customer_name.trim() || null,
            first_name: firstName,
            last_name: lastName,
            email: formData.customer_email.trim().toLowerCase() || null,
            organization_name: formData.company_name.trim() || null,
            phone: formData.phone_number.trim() || null,
          })
          .eq('id', workItem.customer_id)

        if (customerError) throw customerError
      }

      // Update work-item-specific fields (not customer data)
      await updateWorkItem.mutateAsync({
        id: workItem.id,
        updates: {
          phone_number: formData.phone_number.trim() || null,
          address: formData.address.trim() || null,
          website: formData.website.trim() || null,
          lead_source: formData.lead_source || null,
          industry: formData.industry.trim() || null,
          company_size: formData.company_size || null,
          secondary_contacts: secondaryContacts,
        } as any,
      })

      // Invalidate queries to refresh customer data
      queryClient.invalidateQueries({ queryKey: ['work-item'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })

      toast.success('Customer details updated')
      setIsEditing(false)
    } catch (error) {
      toast.error('Failed to update details')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    const c = workItem.customer
    setFormData({
      customer_name: c?.display_name || workItem.customer_name || '',
      customer_email: c?.email || workItem.customer_email || '',
      company_name: c?.organization_name || workItem.company_name || '',
      phone_number: c?.phone || workItem.phone_number || '',
      address: workItem.address || '',
      website: workItem.website || '',
      lead_source: workItem.lead_source || '',
      industry: workItem.industry || '',
      company_size: workItem.company_size || '',
    })
    setSecondaryContacts(workItem.secondary_contacts || [])
    setIsEditing(false)
  }

  const addSecondaryContact = () => {
    setSecondaryContacts([...secondaryContacts, { name: '', email: '', phone: '', role: '' }])
  }

  const removeSecondaryContact = (index: number) => {
    setSecondaryContacts(secondaryContacts.filter((_, i) => i !== index))
  }

  const updateSecondaryContact = (index: number, field: keyof SecondaryContact, value: string) => {
    const updated = [...secondaryContacts]
    updated[index] = { ...updated[index], [field]: value }
    setSecondaryContacts(updated)
  }

  if (!isEditing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Customer Details</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Contact */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Primary Contact
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <p className="font-medium">{resolvedName || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="font-medium">{resolvedEmail || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <p className="font-medium">{resolvedPhone || '-'}</p>
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Company Name</Label>
                <p className="font-medium">{resolvedCompany || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Industry</Label>
                <p className="font-medium">{formData.industry || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Company Size</Label>
                <p className="font-medium">{formData.company_size || '-'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                {formData.website ? (
                  <a
                    href={formData.website.startsWith('http') ? formData.website : `https://${formData.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {formData.website}
                    <Globe className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="font-medium">-</p>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          {formData.address && (
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
              </Label>
              <p className="font-medium whitespace-pre-wrap">{formData.address}</p>
            </div>
          )}

          {/* Lead Source */}
          {formData.lead_source && (
            <div>
              <Label className="text-xs text-muted-foreground">Lead Source</Label>
              <p className="font-medium">{formData.lead_source}</p>
            </div>
          )}

          {/* Secondary Contacts */}
          {secondaryContacts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-3">Secondary Contacts</h3>
              <div className="space-y-3">
                {secondaryContacts.map((contact, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span> {contact.name}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span> {contact.email}
                      </div>
                      {contact.phone && (
                        <div>
                          <span className="text-muted-foreground">Phone:</span> {contact.phone}
                        </div>
                      )}
                      {contact.role && (
                        <div>
                          <span className="text-muted-foreground">Role:</span> {contact.role}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Edit Customer Details</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Check className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Contact */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Primary Contact
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Contact Name *</Label>
              <Input
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.customer_email}
                onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Company Name</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <Label>Industry</Label>
              <Input
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                placeholder="Technology, Retail, etc."
              />
            </div>
            <div>
              <Label>Company Size</Label>
              <Select value={formData.company_size} onValueChange={(value) => setFormData({ ...formData, company_size: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-1000">201-1000 employees</SelectItem>
                  <SelectItem value="1000+">1000+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Website</Label>
              <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div>
          <Label className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Address
          </Label>
          <Textarea
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder={"123 Main St\nSuite 100\nCity, State 12345"}
            rows={3}
          />
        </div>

        {/* Lead Source */}
        <div>
          <Label>Lead Source</Label>
          <Select value={formData.lead_source} onValueChange={(value) => setFormData({ ...formData, lead_source: value })}>
            <SelectTrigger>
              <SelectValue placeholder="How did they find you?" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="social_media">Social Media</SelectItem>
              <SelectItem value="google_search">Google Search</SelectItem>
              <SelectItem value="paid_ad">Paid Advertisement</SelectItem>
              <SelectItem value="event">Event/Conference</SelectItem>
              <SelectItem value="shopify">Shopify Store</SelectItem>
              <SelectItem value="email_campaign">Email Campaign</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Secondary Contacts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Secondary Contacts</h3>
            <Button variant="outline" size="sm" onClick={addSecondaryContact}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contact
            </Button>
          </div>
          <div className="space-y-3">
            {secondaryContacts.map((contact, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Contact {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSecondaryContact(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="Name"
                    value={contact.name}
                    onChange={(e) => updateSecondaryContact(index, 'name', e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateSecondaryContact(index, 'email', e.target.value)}
                  />
                  <Input
                    placeholder="Phone (optional)"
                    value={contact.phone || ''}
                    onChange={(e) => updateSecondaryContact(index, 'phone', e.target.value)}
                  />
                  <Input
                    placeholder="Role (optional)"
                    value={contact.role || ''}
                    onChange={(e) => updateSecondaryContact(index, 'role', e.target.value)}
                  />
                </div>
              </div>
            ))}
            {secondaryContacts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No secondary contacts added yet
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
