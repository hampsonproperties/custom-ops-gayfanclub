'use client'

/**
 * Assign Designer Dialog
 * Allows assigning a team member (designer) to a project
 * Creates activity log entry when designer is assigned/unassigned
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { UserPlus, Loader2 } from 'lucide-react'

interface AssignDesignerDialogProps {
  projectId: string
  currentDesignerId?: string | null
  trigger?: React.ReactNode
  onAssigned?: () => void
}

export function AssignDesignerDialog({
  projectId,
  currentDesignerId,
  trigger,
  onAssigned
}: AssignDesignerDialogProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedDesignerId, setSelectedDesignerId] = useState(currentDesignerId || '')

  // Fetch all users who can be designers
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

  const assignMutation = useMutation({
    mutationFn: async (designerId: string | null) => {
      const supabase = createClient()

      // Update work item
      const { error } = await supabase
        .from('work_items')
        .update({ assigned_to_user_id: designerId || null })
        .eq('id', projectId)

      if (error) throw error

      // Create activity log
      const { data: { user } } = await supabase.auth.getUser()
      const designer = users?.find(u => u.id === designerId)

      await supabase.from('activity_logs').insert({
        activity_type: designerId ? 'designer_assigned' : 'designer_unassigned',
        related_entity_type: 'work_item',
        related_entity_id: projectId,
        user_id: user?.id,
        metadata: {
          designer_id: designerId,
          designer_name: designer?.full_name || designer?.email
        }
      })
    },
    onSuccess: () => {
      toast.success(selectedDesignerId ? 'Designer assigned successfully' : 'Designer unassigned')
      queryClient.invalidateQueries({ queryKey: ['work-items'] })
      queryClient.invalidateQueries({ queryKey: ['project-detail'] })
      queryClient.invalidateQueries({ queryKey: ['customer-profile'] })
      setOpen(false)
      if (onAssigned) onAssigned()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign designer')
    },
  })

  const handleAssign = () => {
    assignMutation.mutate(selectedDesignerId || null)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Assign Designer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Designer</DialogTitle>
          <DialogDescription>
            Select a team member to assign to this project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="designer">Designer</Label>
            <Select
              value={selectedDesignerId}
              onValueChange={setSelectedDesignerId}
            >
              <SelectTrigger id="designer">
                <SelectValue placeholder="Select designer" />
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
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={assignMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
