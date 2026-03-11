'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/lib/logger'

const log = logger('mention-input')

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
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Pre-fetch users on mount so the list is ready when @ is typed
  useEffect(() => {
    async function fetchUsers() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name')
        .order('full_name')

      if (error) {
        log.error('Failed to fetch users for mentions', { error })
        return
      }

      if (data && data.length > 0) {
        setUsers(data as User[])
      }
    }

    fetchUsers()
  }, [])

  // Position the dropdown using a portal to avoid overflow clipping
  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.min(rect.width, 280),
    })
  }, [])

  useEffect(() => {
    if (showMentions) {
      updateDropdownPosition()
    }
  }, [showMentions, updateDropdownPosition])

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    if (!mentionSearch) return true
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

      // Only show if there's no space in the text after @ (still typing the name)
      if ((lastAtIndex === 0 || /\s/.test(textBeforeCursor[lastAtIndex - 1])) && !/\s/.test(textAfterAt)) {
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

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showMentions) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowMentions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMentions])

  const dropdown = showMentions && filteredUsers.length > 0 && dropdownPos && createPortal(
    <div
      className="bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto"
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
      }}
    >
      {filteredUsers.map((user, index) => (
        <button
          key={user.id}
          type="button"
          className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
            index === selectedIndex ? 'bg-accent' : ''
          }`}
          onMouseDown={(e) => { e.preventDefault(); insertMention(user) }}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <div className="font-medium text-sm">
            {user.full_name || 'No name'}
          </div>
          <div className="text-xs text-muted-foreground">{user.email}</div>
        </button>
      ))}
    </div>,
    document.body
  )

  return (
    <div ref={containerRef} className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />

      {dropdown}

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground mt-1">
        Type @ to mention team members
      </p>
    </div>
  )
}
