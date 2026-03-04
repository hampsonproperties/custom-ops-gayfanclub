'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, CheckCircle, Info, Loader2, DollarSign, Calendar, User, Mail, Phone, Building2, Tag } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { logger } from '@/lib/logger'

interface ShopifyCustomerInfo {
  exists: boolean
  customer?: {
    id: string
    email: string
    first_name: string
    last_name: string
    phone: string | null
    total_spent: string
    orders_count: number
    tags: string
    created_at: string
  }
}

const log = logger('lead-new')

export default function NewLeadPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingShopify, setIsCheckingShopify] = useState(false)
  const [shopifyInfo, setShopifyInfo] = useState<ShopifyCustomerInfo | null>(null)

  // Form state
  const [email, setEmail] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [leadSource, setLeadSource] = useState('email')
  const [estimatedValue, setEstimatedValue] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [notes, setNotes] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [tags, setTags] = useState('')

  // Debounced Shopify lookup
  useEffect(() => {
    if (!email || !email.includes('@')) {
      setShopifyInfo(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsCheckingShopify(true)
      try {
        const response = await fetch(`/api/shopify/lookup-customer?email=${encodeURIComponent(email)}`)
        const data = await response.json()
        setShopifyInfo(data)

        // Auto-fill if customer exists in Shopify
        if (data.exists && data.customer) {
          const fullName = `${data.customer.first_name} ${data.customer.last_name}`.trim()
          if (fullName && !customerName) {
            setCustomerName(fullName)
          }
          if (data.customer.phone && !phone) {
            setPhone(data.customer.phone)
          }
        }
      } catch (error) {
        log.error('Failed to lookup customer', { error })
      } finally {
        setIsCheckingShopify(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !customerName) {
      toast.error('Email and customer name are required')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()

      // Get current user for assignment
      const { data: { user } } = await supabase.auth.getUser()

      const leadData = {
        type: 'assisted_project' as const,
        source: 'manual' as const,
        status: 'new_inquiry' as const,
        customer_email: email.toLowerCase().trim(),
        customer_name: customerName.trim(),
        phone_number: phone.trim() || null,
        company_name: companyName.trim() || null,
        lead_source: leadSource,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
        event_date: eventDate || null,
        shopify_customer_id: shopifyInfo?.customer?.id || null,
        assigned_to_user_id: assignedTo || user?.id || null,
      }

      // Create work item
      const { data: workItem, error: workItemError } = await supabase
        .from('work_items')
        .insert(leadData)
        .select()
        .single()

      if (workItemError) throw workItemError

      // Add initial note if provided
      if (notes.trim()) {
        await supabase.from('work_item_notes').insert({
          work_item_id: workItem.id,
          content: notes.trim(),
          author_email: user?.email || 'system@gayfanclub.com',
        })
      }

      // Add tags if provided
      if (tags.trim()) {
        const tagNames = tags.split(',').map(t => t.trim()).filter(Boolean)
        for (const tagName of tagNames) {
          // Find or create tag
          let { data: tag } = await supabase
            .from('tags')
            .select('id')
            .eq('name', tagName)
            .single()

          if (!tag) {
            const { data: newTag } = await supabase
              .from('tags')
              .insert({ name: tagName, color: '#6366f1' })
              .select()
              .single()
            tag = newTag
          }

          if (tag) {
            await supabase.from('work_item_tags').insert({
              work_item_id: workItem.id,
              tag_id: tag.id,
            })
          }
        }
      }

      toast.success('Lead created successfully!')
      router.push(`/work-items/${workItem.id}`)
    } catch (error: any) {
      log.error('Failed to create lead', { error })
      toast.error(error.message || 'Failed to create lead')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/sales-leads">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Sales Leads
          </Button>
        </Link>

        <div>
          <h1 className="text-3xl font-bold">Create New Lead</h1>
          <p className="text-muted-foreground">Add a new sales inquiry to your pipeline</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
            <CardDescription>
              Enter customer details. We'll check if they exist in Shopify automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email with Shopify Lookup */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Customer Email *
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="dylan@prideevent.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pr-24"
                />
                {isCheckingShopify && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Shopify Status */}
              {shopifyInfo && !isCheckingShopify && (
                <div className="mt-2">
                  {shopifyInfo.exists && shopifyInfo.customer ? (
                    <div className="flex items-start gap-3 p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Existing Shopify Customer
                        </p>
                        <div className="text-sm text-green-700 dark:text-green-300 space-y-0.5">
                          <p>
                            • {shopifyInfo.customer.orders_count} past order
                            {shopifyInfo.customer.orders_count !== 1 ? 's' : ''} (${shopifyInfo.customer.total_spent} total)
                          </p>
                          <p>
                            • Customer since{' '}
                            {formatDistanceToNow(new Date(shopifyInfo.customer.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                          {shopifyInfo.customer.tags && (
                            <p>• Tagged: {shopifyInfo.customer.tags}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <Info className="h-5 w-5 text-blue-600 dark:text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          New Customer
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          No Shopify history found. This is a first-time inquiry.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Customer Name */}
            <div className="space-y-2">
              <Label htmlFor="customerName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Customer Name *
              </Label>
              <Input
                id="customerName"
                type="text"
                placeholder="Dylan Cohere"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>

            {/* Phone & Company - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  type="text"
                  placeholder="Pride Festival LLC"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
            </div>

            {/* Lead Source & Estimated Value - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leadSource">Lead Source</Label>
                <Select value={leadSource} onValueChange={setLeadSource}>
                  <SelectTrigger id="leadSource">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email Inquiry</SelectItem>
                    <SelectItem value="form">Contact Form</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="trade_show">Trade Show</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="social_media">Social Media</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimatedValue" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Estimated Value
                </Label>
                <Input
                  id="estimatedValue"
                  type="number"
                  placeholder="2500"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            {/* Event Date */}
            <div className="space-y-2">
              <Label htmlFor="eventDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Event Date (if applicable)
              </Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>

            {/* Assign To */}
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assign To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="assignedTo">
                  <SelectValue placeholder="Assign to yourself" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {/* These will be populated from users table */}
                  <SelectItem value="current">Assign to Me</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave blank to assign to yourself
              </p>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </Label>
              <Input
                id="tags"
                type="text"
                placeholder="pride, festival, bulk (comma-separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple tags with commas
              </p>
            </div>

            {/* Initial Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Initial Notes</Label>
              <Textarea
                id="notes"
                placeholder="Wants 200 custom pride flags for June festival. Discussed rainbow gradient design..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Lead...
                  </>
                ) : (
                  'Create Lead'
                )}
              </Button>
              <Link href="/sales-leads">
                <Button type="button" variant="outline" size="lg">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Info Box */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-500 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium">What happens next?</p>
              <ul className="space-y-1 list-disc list-inside text-blue-700 dark:text-blue-300">
                <li>Lead is created with status "New Inquiry"</li>
                <li>
                  If customer pays online, their Shopify order will automatically link to this lead
                </li>
                <li>You can create a Shopify invoice from the lead detail page</li>
                <li>Track progress through your sales pipeline</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
