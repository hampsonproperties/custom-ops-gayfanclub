'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAllTags, useWorkItemTags, useAddTag, useRemoveTag } from '@/lib/hooks/use-tags'
import { Tag, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

export function TagManager({ workItemId }: { workItemId: string }) {
  const { data: allTags } = useAllTags()
  const { data: workItemTags } = useWorkItemTags(workItemId)
  const addTag = useAddTag()
  const removeTag = useRemoveTag()

  const currentTagIds = workItemTags?.map((wt) => wt.tag_id) || []
  const availableTags = allTags?.filter((t) => !currentTagIds.includes(t.id)) || []

  const handleAddTag = async (tagId: string) => {
    try {
      await addTag.mutateAsync({ workItemId, tagId })
      toast.success('Tag added')
    } catch (error) {
      toast.error('Failed to add tag')
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTag.mutateAsync({ workItemId, tagId })
      toast.success('Tag removed')
    } catch (error) {
      toast.error('Failed to remove tag')
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {workItemTags?.map((wt) => (
        <Badge
          key={wt.tag_id}
          style={{ backgroundColor: wt.tag.color }}
          className="gap-1 text-white"
        >
          {wt.tag.name}
          <button
            onClick={() => handleRemoveTag(wt.tag_id)}
            className="ml-1 hover:bg-white/20 rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {availableTags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 gap-1">
              <Plus className="h-3 w-3" />
              Add Tag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50">
            {availableTags.map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                onClick={() => handleAddTag(tag.id)}
                className="gap-2"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
