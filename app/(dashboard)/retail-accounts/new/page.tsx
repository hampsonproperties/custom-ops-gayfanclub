'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { ArrowLeft, Building2, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCreateRetailAccount } from '@/lib/hooks/use-retail-accounts'
import { toast } from 'sonner'

export default function NewRetailAccountPage() {
  const router = useRouter()
  const createAccount = useCreateRetailAccount()

  const [formData, setFormData] = useState({
    account_name: '',
    account_type: 'retailer' as 'retailer' | 'corporate' | 'venue' | 'other',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    billing_email: '',
    business_address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'US',
    website_url: '',
    tax_id: '',
    status: 'prospect' as 'active' | 'inactive' | 'on_hold' | 'prospect',
    credit_limit: '',
    payment_terms: '',
    industry: '',
    internal_notes: '',
  })

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.account_name) {
      toast.error('Account name is required')
      return
    }

    try {
      const account = await createAccount.mutateAsync({
        account_name: formData.account_name,
        account_type: formData.account_type,
        primary_contact_name: formData.primary_contact_name || null,
        primary_contact_email: formData.primary_contact_email || null,
        primary_contact_phone: formData.primary_contact_phone || null,
        billing_email: formData.billing_email || null,
        business_address: formData.business_address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        country: formData.country || 'US',
        website_url: formData.website_url || null,
        tax_id: formData.tax_id || null,
        status: formData.status,
        credit_limit: formData.credit_limit ? Number(formData.credit_limit) : null,
        payment_terms: formData.payment_terms || null,
        industry: formData.industry || null,
        internal_notes: formData.internal_notes || null,
      })

      toast.success('Account created successfully!')
      router.push(`/retail-accounts/${account.id}`)
    } catch (error) {
      console.error('Failed to create account:', error)
      toast.error('Failed to create account')
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/retail-accounts">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">New Retail Account</h1>
          <p className="text-muted-foreground">Create a new B2B wholesale customer account</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Essential details about the account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account_name">
                  Account Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="account_name"
                  placeholder="Pride Store SF"
                  value={formData.account_name}
                  onChange={(e) => handleChange('account_name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_type">Account Type</Label>
                <Select
                  value={formData.account_type}
                  onValueChange={(value) => handleChange('account_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retailer">Retailer (Store)</SelectItem>
                    <SelectItem value="corporate">Corporate (Company)</SelectItem>
                    <SelectItem value="venue">Venue (Event Space)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="Retail, Events, etc."
                  value={formData.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>
              Primary contact details for this account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_contact_name">Contact Name</Label>
                <Input
                  id="primary_contact_name"
                  placeholder="John Doe"
                  value={formData.primary_contact_name}
                  onChange={(e) => handleChange('primary_contact_name', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary_contact_email">Contact Email</Label>
                <Input
                  id="primary_contact_email"
                  type="email"
                  placeholder="john@pridestore.com"
                  value={formData.primary_contact_email}
                  onChange={(e) => handleChange('primary_contact_email', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="primary_contact_phone">Contact Phone</Label>
                <Input
                  id="primary_contact_phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.primary_contact_phone}
                  onChange={(e) => handleChange('primary_contact_phone', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing_email">Billing Email</Label>
                <Input
                  id="billing_email"
                  type="email"
                  placeholder="billing@pridestore.com"
                  value={formData.billing_email}
                  onChange={(e) => handleChange('billing_email', e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="website_url">Website</Label>
                <Input
                  id="website_url"
                  type="url"
                  placeholder="https://pridestore.com"
                  value={formData.website_url}
                  onChange={(e) => handleChange('website_url', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Details */}
        <Card>
          <CardHeader>
            <CardTitle>Business Details</CardTitle>
            <CardDescription>
              Address and business information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="business_address">Street Address</Label>
                <Input
                  id="business_address"
                  placeholder="123 Market Street"
                  value={formData.business_address}
                  onChange={(e) => handleChange('business_address', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="San Francisco"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="CA"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip Code</Label>
                <Input
                  id="zip_code"
                  placeholder="94102"
                  value={formData.zip_code}
                  onChange={(e) => handleChange('zip_code', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID / EIN</Label>
                <Input
                  id="tax_id"
                  placeholder="12-3456789"
                  value={formData.tax_id}
                  onChange={(e) => handleChange('tax_id', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Terms */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Terms</CardTitle>
            <CardDescription>
              Credit and payment information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="credit_limit">Credit Limit ($)</Label>
                <Input
                  id="credit_limit"
                  type="number"
                  placeholder="10000"
                  value={formData.credit_limit}
                  onChange={(e) => handleChange('credit_limit', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_terms">Payment Terms</Label>
                <Select
                  value={formData.payment_terms}
                  onValueChange={(value) => handleChange('payment_terms', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                    <SelectItem value="Net 15">Net 15</SelectItem>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                    <SelectItem value="Net 90">Net 90</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Internal Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Internal Notes</CardTitle>
            <CardDescription>
              Private notes about this account (not visible to customer)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              id="internal_notes"
              placeholder="Add any internal notes about this account..."
              rows={4}
              value={formData.internal_notes}
              onChange={(e) => handleChange('internal_notes', e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href="/retail-accounts">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={createAccount.isPending} className="gap-2">
            {createAccount.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Create Account
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
