'use client'

import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string
  full_name: string | null
}

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onMention?: (userId: string, userName: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export function MentionInput({
  value,
  onChange,
  onMention,
  placeholder,
  rows = 3,
  className
}: MentionInputProps) {
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch users when @ is typed
  useEffect(() => {
    async function fetchUsers() {
      if (!showMentions) return

      const supabase = createClient()
      const { data } = await supabase
        .from('users')
        .select('id, email, full_name')
        .order('full_name')

      if (data) {
        setUsers(data as User[])
      }
    }

    fetchUsers()
  }, [showMentions])

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    const search = mentionSearch.toLowerCase()
    return (
      user.full_name?.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search)
    )
  })

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const newCursorPos = e.target.selectionStart

    onChange(newValue)
    setCursorPosition(newCursorPos)

    // Check if @ was just typed
    const textBeforeCursor = newValue.substring(0, newCursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)

      // Show mentions if @ is at start of word
      if (lastAtIndex === 0 || /\s/.test(textBeforeCursor[lastAtIndex - 1])) {
        setShowMentions(true)
        setMentionSearch(textAfterAt)
        setSelectedIndex(0)
      } else {
        setShowMentions(false)
      }
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (user: User) => {
    const textBeforeCursor = value.substring(0, cursorPosition)
    const textAfterCursor = value.substring(cursorPosition)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    const beforeAt = value.substring(0, lastAtIndex)
    const mention = `@${user.full_name || user.email}`
    const newValue = beforeAt + mention + ' ' + textAfterCursor

    onChange(newValue)
    setShowMentions(false)
    setMentionSearch('')

    // Call mention callback
    if (onMention) {
      onMention(user.id, user.full_name || user.email)
    }

    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus()
      const newCursorPos = beforeAt.length + mention.length + 1
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions || filteredUsers.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredUsers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length)
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      insertMention(filteredUsers[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowMentions(false)
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />

      {/* Mentions Dropdown */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              type="button"
              className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
                index === selectedIndex ? 'bg-accent' : ''
              }`}
              onClick={() => insertMention(user)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="font-medium text-sm">
                {user.full_name || 'No name'}
              </div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </button>
          ))}
        </div>
      )}

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground mt-1">
        Type @ to mention team members
      </p>
    </div>
  )
}
