'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useRecategorizeEmail, type EmailCategory } from '@/lib/hooks/use-email-filters'
import { MoreVertical, Bell, ShoppingBag, AlertOctagon, Mail, Check } from 'lucide-react'
import { toast } from 'sonner'

interface EmailCategoryMenuProps {
  emailId: string
  fromEmail: string
  currentCategory: EmailCategory
}

const CATEGORY_OPTIONS = [
  {
    value: 'notifications' as EmailCategory,
    label: 'Move to Notifications',
    icon: Bell,
    description: 'System emails, receipts, alerts',
    color: 'text-blue-600',
  },
  {
    value: 'promotional' as EmailCategory,
    label: 'Move to Promotional',
    icon: ShoppingBag,
    description: 'Marketing, newsletters, sales',
    color: 'text-purple-600',
  },
  {
    value: 'spam' as EmailCategory,
    label: 'Mark as Spam',
    icon: AlertOctagon,
    description: 'Unwanted emails',
    color: 'text-red-600',
  },
  {
    value: 'primary' as EmailCategory,
    label: 'Move to Primary',
    icon: Mail,
    description: 'Important customer emails',
    color: 'text-green-600',
  },
]

export function EmailCategoryMenu({ emailId, fromEmail, currentCategory }: EmailCategoryMenuProps) {
  const recategorize = useRecategorizeEmail()
  const [applyToFuture, setApplyToFuture] = useState(true)
  const [useDomain, setUseDomain] = useState(false)

  const handleRecategorize = async (newCategory: EmailCategory, applyTo: 'email' | 'domain') => {
    try {
      await recategorize.mutateAsync({
        emailId,
        fromEmail,
        newCategory,
        applyToFuture: true,
        useDomain: applyTo === 'domain',
      })

      const categoryLabel = CATEGORY_OPTIONS.find((c) => c.value === newCategory)?.label || newCategory
      const scope = applyTo === 'domain' ? `all emails from @${fromEmail.split('@')[1]}` : fromEmail

      toast.success(`${categoryLabel.replace('Move to ', '')} - Future emails from ${scope} will be categorized automatically.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to recategorize')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Categorize Email</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {CATEGORY_OPTIONS.filter((option) => option.value !== currentCategory).map((option) => {
          const Icon = option.icon
          return (
            <DropdownMenuSub key={option.value}>
              <DropdownMenuSubTrigger>
                <Icon className={`mr-2 h-4 w-4 ${option.color}`} />
                <div className="flex-1">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => handleRecategorize(option.value, 'email')}>
                  <Mail className="mr-2 h-4 w-4" />
                  <div>
                    <div className="font-medium">This sender only</div>
                    <div className="text-xs text-muted-foreground">{fromEmail}</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleRecategorize(option.value, 'domain')}>
                  <Bell className="mr-2 h-4 w-4" />
                  <div>
                    <div className="font-medium">Entire domain</div>
                    <div className="text-xs text-muted-foreground">@{fromEmail.split('@')[1]}</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )
        })}

        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Future emails will be categorized automatically
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
