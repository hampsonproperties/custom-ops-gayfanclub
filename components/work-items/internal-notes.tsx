'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MentionInput } from './mention-input'
import { useNotes, useCreateNote, useDeleteNote } from '@/lib/hooks/use-notes'
import { Lock, Plus, Trash2, AtSign } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

// Helper to render note content with highlighted mentions
function renderNoteWithMentions(content: string) {
  const mentionRegex = /@(\w+(?:\s+\w+)*)/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index))
    }

    // Add highlighted mention
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-medium"
      >
        <AtSign className="h-3 w-3" />
        {match[1]}
      </span>
    )

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex))
  }

  return parts.length > 0 ? parts : content
}

export function InternalNotes({ workItemId }: { workItemId: string }) {
  const { data: notes, isLoading } = useNotes(workItemId)
  const createNote = useCreateNote()
  const deleteNote = useDeleteNote()

  const [isAdding, setIsAdding] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [mentionedUsers, setMentionedUsers] = useState<Array<{ id: string; name: string }>>([])

  const handleMention = (userId: string, userName: string) => {
    setMentionedUsers(prev => [...prev, { id: userId, name: userName }])
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error('Please enter a note')
      return
    }

    try {
      await createNote.mutateAsync({
        workItemId,
        content: newNote,
      })
      toast.success('Note added')
      setNewNote('')
      setIsAdding(false)
    } catch (error) {
      toast.error('Failed to add note')
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return

    try {
      await deleteNote.mutateAsync({ noteId, workItemId })
      toast.success('Note deleted')
    } catch (error) {
      toast.error('Failed to delete note')
    }
  }

  if (isLoading) {
    return <div className="text-muted-foreground">Loading notes...</div>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Internal Notes
            <span className="text-sm text-muted-foreground font-normal">(Team only)</span>
          </CardTitle>
          {!isAdding && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAdding(true)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add New Note */}
        {isAdding && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
            <MentionInput
              placeholder="Add internal note (not visible to customer)..."
              value={newNote}
              onChange={setNewNote}
              onMention={handleMention}
              rows={3}
              className="bg-background"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={createNote.isPending}
              >
                {createNote.isPending ? 'Saving...' : 'Save Note'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false)
                  setNewNote('')
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Notes List */}
        {notes && notes.length > 0 ? (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="border rounded-lg p-4 space-y-2 bg-background"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{note.author_email}</span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(note.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteNote(note.id)}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {renderNoteWithMentions(note.content)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          !isAdding && (
            <div className="text-center py-8 text-muted-foreground">
              <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No internal notes yet</p>
              <p className="text-xs">Add private notes for team collaboration</p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
