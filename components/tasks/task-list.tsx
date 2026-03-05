'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Trash2, Loader2, CalendarDays } from 'lucide-react'
import { useTasks, useToggleTask, useDeleteTask } from '@/lib/hooks/use-tasks'
import { format, isPast, isToday } from 'date-fns'
import { cn } from '@/lib/utils'

interface TaskListProps {
  workItemId?: string
  customerId?: string
}

export function TaskList({ workItemId, customerId }: TaskListProps) {
  const { data: tasks, isLoading } = useTasks({ workItemId, customerId })
  const toggleTask = useToggleTask()
  const deleteTask = useDeleteTask()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading tasks...
      </div>
    )
  }

  if (!tasks || tasks.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground text-sm">
        No tasks yet
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {tasks.map((task) => {
        const isCompleted = !!task.completed_at
        const isOverdue =
          !isCompleted &&
          task.due_date &&
          isPast(new Date(task.due_date)) &&
          !isToday(new Date(task.due_date))

        return (
          <div
            key={task.id}
            className="group flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <Checkbox
              checked={isCompleted}
              onCheckedChange={(checked) => {
                toggleTask.mutate({ taskId: task.id, completed: !!checked })
              }}
            />

            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm truncate',
                  isCompleted && 'line-through text-muted-foreground'
                )}
              >
                {task.title}
              </p>
            </div>

            {task.assigned_to && (
              <Avatar className="h-6 w-6 flex-shrink-0">
                <AvatarFallback className="text-[10px] bg-muted">
                  {(task.assigned_to.full_name || task.assigned_to.email)
                    .substring(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}

            {task.due_date && (
              <span
                className={cn(
                  'text-xs whitespace-nowrap flex items-center gap-1',
                  isOverdue
                    ? 'text-red-600 dark:text-red-400 font-medium'
                    : 'text-muted-foreground',
                  isCompleted && 'text-muted-foreground line-through'
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              onClick={() => deleteTask.mutate({ taskId: task.id })}
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
