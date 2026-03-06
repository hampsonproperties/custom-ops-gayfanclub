'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type Notification,
} from '@/lib/hooks/use-notifications'
import { useMyTasks, useToggleTask } from '@/lib/hooks/use-tasks'
import { Bell, CheckCheck, Circle, ListTodo, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

export default function AlertsPage() {
  const { data: notifications, isLoading: notifLoading } = useNotifications()
  const { data: myTasks, isLoading: tasksLoading } = useMyTasks()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const toggleTask = useToggleTask()

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0

  if (notifLoading && tasksLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Alerts</h1>
        <p className="text-muted-foreground">Notifications and tasks assigned to you</p>
      </div>

      {/* My Tasks */}
      {myTasks && myTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              My Tasks ({myTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1">
            {myTasks.map((task) => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date()
              return (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors">
                  <button
                    type="button"
                    onClick={() => toggleTask.mutate({ taskId: task.id, completed: true })}
                    className="shrink-0 text-muted-foreground hover:text-primary"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{task.title}</div>
                    {task.due_date && (
                      <div className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        Due {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                  {task.work_item_id && (
                    <Link href={`/work-items/${task.work_item_id}`} className="text-xs text-primary hover:underline shrink-0">
                      View
                    </Link>
                  )}
                  {!task.work_item_id && task.customer_id && (
                    <Link href={`/customers/${task.customer_id}`} className="text-xs text-primary hover:underline shrink-0">
                      View
                    </Link>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">
                  {unreadCount}
                </Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          {!notifications || notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                    notif.is_read ? 'opacity-60' : 'bg-muted/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${notif.is_read ? '' : 'font-medium'}`}>
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    {notif.message && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                    )}
                    {notif.created_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {notif.link && (
                      <Link href={notif.link}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                    {!notif.is_read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => markRead.mutate({ notificationId: notif.id })}
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
