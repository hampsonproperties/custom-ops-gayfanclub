'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  User,
  Briefcase,
  Mail,
  FileText,
  Package,
  Search,
  Inbox,
  Calendar,
  Settings,
} from 'lucide-react'

interface SearchResult {
  id: string
  type: 'customer' | 'work_item' | 'communication' | 'file' | 'batch'
  title: string
  subtitle?: string
  url: string
  icon?: React.ReactNode
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  // Listen for Cmd+K or / key
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      if (e.key === '/' && !open) {
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [open])

  // Search function with debouncing
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      setResults(data.results || [])
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery('')
    router.push(result.url)
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'customer':
        return <User className="h-4 w-4" />
      case 'work_item':
        return <Briefcase className="h-4 w-4" />
      case 'communication':
        return <Mail className="h-4 w-4" />
      case 'file':
        return <FileText className="h-4 w-4" />
      case 'batch':
        return <Package className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'customer':
        return 'Customer'
      case 'work_item':
        return 'Work Item'
      case 'communication':
        return 'Email'
      case 'file':
        return 'File'
      case 'batch':
        return 'Batch'
      default:
        return type
    }
  }

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  // Quick actions (shown when no search query)
  const quickActions = [
    {
      id: 'inbox',
      title: 'My Inbox',
      subtitle: 'View your priority emails',
      url: '/inbox/my-inbox',
      icon: <Inbox className="h-4 w-4" />,
    },
    {
      id: 'work-items',
      title: 'Work Items',
      subtitle: 'View all projects and orders',
      url: '/work-items',
      icon: <Briefcase className="h-4 w-4" />,
    },
    {
      id: 'customers',
      title: 'Customers',
      subtitle: 'Browse customer directory',
      url: '/customers',
      icon: <User className="h-4 w-4" />,
    },
    {
      id: 'batches',
      title: 'Batches',
      subtitle: 'View print batches',
      url: '/batches',
      icon: <Package className="h-4 w-4" />,
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'Account and preferences',
      url: '/settings',
      icon: <Settings className="h-4 w-4" />,
    },
  ]

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search customers, work items, emails, files..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? 'Searching...' : 'No results found.'}
        </CommandEmpty>

        {/* Show quick actions when no query */}
        {!query && (
          <>
            <CommandGroup heading="Quick Actions">
              {quickActions.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => {
                    setOpen(false)
                    router.push(action.url)
                  }}
                >
                  {action.icon}
                  <div className="ml-2 flex flex-col">
                    <span className="font-medium">{action.title}</span>
                    {action.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {action.subtitle}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Show search results grouped by type */}
        {query && Object.keys(groupedResults).length > 0 && (
          <>
            {Object.entries(groupedResults).map(([type, items], index) => (
              <div key={type}>
                {index > 0 && <CommandSeparator />}
                <CommandGroup heading={`${getTypeLabel(type)}s`}>
                  {items.map((result) => (
                    <CommandItem
                      key={result.id}
                      onSelect={() => handleSelect(result)}
                    >
                      {getIcon(result.type)}
                      <div className="ml-2 flex flex-col flex-1">
                        <span className="font-medium">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-muted-foreground truncate">
                            {result.subtitle}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground ml-2">
                        {getTypeLabel(result.type)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </>
        )}
      </CommandList>

      <div className="border-t p-2 text-xs text-muted-foreground text-center">
        Press <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd> or <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          /
        </kbd> to toggle
      </div>
    </CommandDialog>
  )
}
