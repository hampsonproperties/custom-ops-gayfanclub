'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Mail } from 'lucide-react'
import { useUpdateWorkItem } from '@/lib/hooks/use-work-items'
import { toast } from 'sonner'

interface AlternateEmailsManagerProps {
  workItemId: string
  customerEmail: string
  alternateEmails: string[]
}

export function AlternateEmailsManager({
  workItemId,
  customerEmail,
  alternateEmails = [],
}: AlternateEmailsManagerProps) {
  const [newEmail, setNewEmail] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const updateWorkItem = useUpdateWorkItem()

  const handleAddEmail = async () => {
    const emailToAdd = newEmail.trim().toLowerCase()

    if (!emailToAdd) {
      toast.error('Please enter an email address')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailToAdd)) {
      toast.error('Please enter a valid email address')
      return
    }

    // Check if email is the primary email
    if (emailToAdd === customerEmail.toLowerCase()) {
      toast.error('This is already the primary email')
      return
    }

    // Check if email already exists in alternates
    if (alternateEmails.some(e => e.toLowerCase() === emailToAdd)) {
      toast.error('This email is already added')
      return
    }

    try {
      await updateWorkItem.mutateAsync({
        id: workItemId,
        updates: {
          alternate_emails: [...alternateEmails, emailToAdd],
        },
      })

      toast.success('Alternate email added successfully')
      setNewEmail('')
      setIsAdding(false)
    } catch (error) {
      toast.error('Failed to add alternate email')
    }
  }

  const handleRemoveEmail = async (emailToRemove: string) => {
    try {
      await updateWorkItem.mutateAsync({
        id: workItemId,
        updates: {
          alternate_emails: alternateEmails.filter(e => e !== emailToRemove),
        },
      })

      toast.success('Alternate email removed')
    } catch (error) {
      toast.error('Failed to remove alternate email')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Customer Emails
          </CardTitle>
          {!isAdding && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              Add Alternate Email
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Email */}
        <div>
          <span className="text-sm text-muted-foreground">Primary Email</span>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="default">{customerEmail}</Badge>
          </div>
        </div>

        {/* Alternate Emails */}
        {alternateEmails.length > 0 && (
          <div>
            <span className="text-sm text-muted-foreground">Alternate Emails</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {alternateEmails.map((email) => (
                <Badge
                  key={email}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {email}
                  <button
                    onClick={() => handleRemoveEmail(email)}
                    className="ml-1 rounded-full hover:bg-muted p-0.5"
                    title="Remove email"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Add Email Form */}
        {isAdding && (
          <div className="border-t pt-4">
            <span className="text-sm font-medium">Add Alternate Email</span>
            <div className="flex gap-2 mt-2">
              <Input
                type="email"
                placeholder="alternate@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
              />
              <Button
                onClick={handleAddEmail}
                disabled={updateWorkItem.isPending}
              >
                Add
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAdding(false)
                  setNewEmail('')
                }}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Emails sent from this address will automatically link to this work item.
            </p>
          </div>
        )}

        {alternateEmails.length === 0 && !isAdding && (
          <p className="text-sm text-muted-foreground">
            No alternate emails added. Add one to link emails from multiple addresses to this customer.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
