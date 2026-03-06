'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'
import { useCreateTask } from '@/lib/hooks/use-tasks'
import { useActiveUsers } from '@/lib/hooks/use-users'
import { toast } from 'sonner'

interface TaskFormProps {
  workItemId?: string
  customerId?: string
  onCreated?: () => void
}

export function TaskForm({ workItemId, customerId, onCreated }: TaskFormProps) {
  const [title, setTitle] = useState('')
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [dueDate, setDueDate] = useState('')

  const { data: users } = useActiveUsers()
  const createTask = useCreateTask()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    createTask.mutate(
      {
        title: title.trim(),
        assigned_to_user_id: assignedTo || undefined,
        due_date: dueDate || undefined,
        work_item_id: workItemId,
        customer_id: customerId,
      },
      {
        onSuccess: () => {
          setTitle('')
          setAssignedTo('')
          setDueDate('')
          toast.success('Task created')
          onCreated?.()
        },
        onError: () => {
          toast.error('Failed to create task')
        },
      }
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Input
        placeholder="Add a task..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full"
        required
      />
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={assignedTo} onValueChange={setAssignedTo}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Assign to..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users?.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.full_name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full sm:w-[160px] max-w-full"
        />
        <Button type="submit" size="sm" disabled={!title.trim() || createTask.isPending} className="gap-1 w-full sm:w-auto">
          {createTask.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add
        </Button>
      </div>
    </form>
  )
}
