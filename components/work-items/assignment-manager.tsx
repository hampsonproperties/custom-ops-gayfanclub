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
import { useActiveUsers } from '@/lib/hooks/use-users'
import { UserCircle, Check } from 'lucide-react'
import { toast } from 'sonner'

export function AssignmentManager({
  workItemId,
  currentAssignee,
}: {
  workItemId: string
  currentAssignee: string | null
}) {
  const updateWorkItem = useUpdateWorkItem()
  const { data: users = [], isLoading } = useActiveUsers()

  const handleAssign = async (email: string | null) => {
    try {
      await updateWorkItem.mutateAsync({
        id: workItemId,
        updates: {
          assigned_to_email: email,
          assigned_at: email ? new Date().toISOString() : null,
        } as any,
      })
      toast.success(email ? `Assigned to ${email}` : 'Assignment removed')
    } catch (error) {
      toast.error('Failed to update assignment')
    }
  }

  // Find current assignee's full name if available
  const currentAssigneeName = users.find((u) => u.email === currentAssignee)?.full_name || currentAssignee

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={isLoading}>
          <UserCircle className="h-4 w-4" />
          {currentAssigneeName || 'Unassigned'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-popover">
        {users.length === 0 && !isLoading && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No users found
          </div>
        )}
        {users.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() => handleAssign(user.email)}
            className="gap-2"
          >
            {currentAssignee === user.email && <Check className="h-4 w-4" />}
            <span className={currentAssignee !== user.email ? 'ml-6' : ''}>
              {user.full_name || user.email}
            </span>
          </DropdownMenuItem>
        ))}
        {currentAssignee && users.length > 0 && (
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
