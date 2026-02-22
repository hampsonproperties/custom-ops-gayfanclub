'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateWorkItem } from '@/lib/hooks/use-work-items'
import { UserCircle, Check } from 'lucide-react'
import { toast } from 'sonner'

// In a real app, you'd fetch this from a users table
const TEAM_MEMBERS = [
  'timothy@thegayfanclub.com',
  'sales@thegayfanclub.com',
  'sarah@thegayfanclub.com',
  'ops@thegayfanclub.com',
]

export function AssignmentManager({
  workItemId,
  currentAssignee,
}: {
  workItemId: string
  currentAssignee: string | null
}) {
  const updateWorkItem = useUpdateWorkItem()

  const handleAssign = async (email: string | null) => {
    try {
      await updateWorkItem.mutateAsync({
        id: workItemId,
        updates: {
          assigned_to_email: email,
          assigned_at: email ? new Date().toISOString() : null,
        },
      })
      toast.success(email ? `Assigned to ${email}` : 'Assignment removed')
    } catch (error) {
      toast.error('Failed to update assignment')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserCircle className="h-4 w-4" />
          {currentAssignee || 'Unassigned'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TEAM_MEMBERS.map((email) => (
          <DropdownMenuItem
            key={email}
            onClick={() => handleAssign(email)}
            className="gap-2"
          >
            {currentAssignee === email && <Check className="h-4 w-4" />}
            <span className={currentAssignee !== email ? 'ml-6' : ''}>
              {email}
            </span>
          </DropdownMenuItem>
        ))}
        {currentAssignee && (
          <>
            <DropdownMenuItem className="border-t" onClick={() => handleAssign(null)}>
              <span className="ml-6 text-muted-foreground">Unassign</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
