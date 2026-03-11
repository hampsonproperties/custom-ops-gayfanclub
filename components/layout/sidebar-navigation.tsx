'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Users,
  User,
  FolderKanban,
  Package,
  Settings,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Inbox,
  Store,
  Building2,
  Target,
} from 'lucide-react'

export function SidebarNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [salesOpen, setSalesOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(true)

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/')
  }

  const isContactFilterActive = (filter: string | null) => {
    if (!isActive('/customers')) return false
    const currentFilter = searchParams.get('filter')
    return filter === null ? currentFilter === null : currentFilter === filter
  }

  // Auto-open sections when a child is active
  const isContactsChildActive = isActive('/customers')
  const isSalesChildActive = isActive('/follow-ups')
  const isEmailChildActive = isActive('/inbox') || isActive('/support-queue')

  return (
    <nav className="flex-1 p-4 space-y-1">
      {/* Dashboard */}
      <Link href="/dashboard">
        <Button
          variant={isActive('/dashboard') ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start gap-3"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Button>
      </Link>

      {/* Contacts Section */}
      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setContactsOpen(!contactsOpen)}
        >
          {contactsOpen || isContactsChildActive ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Users className="h-4 w-4" />
          <span className="font-semibold">Contacts</span>
        </Button>

        {(contactsOpen || isContactsChildActive) && (
          <div className="ml-6 mt-1 space-y-1">
            <Link href="/customers">
              <Button
                variant={isContactFilterActive(null) ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                All Contacts
              </Button>
            </Link>
            <Link href="/customers?filter=leads">
              <Button
                variant={isContactFilterActive('leads') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm gap-2"
              >
                <Target className="h-3.5 w-3.5" />
                Leads
              </Button>
            </Link>
            <Link href="/customers?filter=retailers">
              <Button
                variant={isContactFilterActive('retailers') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm gap-2"
              >
                <Store className="h-3.5 w-3.5" />
                Retailers
              </Button>
            </Link>
            <Link href="/customers?filter=organizations">
              <Button
                variant={isContactFilterActive('organizations') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm gap-2"
              >
                <Building2 className="h-3.5 w-3.5" />
                Organizations
              </Button>
            </Link>
            <Link href="/customers?filter=individuals">
              <Button
                variant={isContactFilterActive('individuals') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm gap-2"
              >
                <User className="h-3.5 w-3.5" />
                Individuals
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Email Section */}
      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setEmailOpen(!emailOpen)}
        >
          {emailOpen || isEmailChildActive ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Inbox className="h-4 w-4" />
          <span className="font-semibold">Email</span>
        </Button>

        {(emailOpen || isEmailChildActive) && (
          <div className="ml-6 mt-1 space-y-1">
            <Link href="/inbox">
              <Button
                variant={isActive('/inbox') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Inbox
              </Button>
            </Link>
            <Link href="/inbox/my-inbox">
              <Button
                variant={isActive('/inbox/my-inbox') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                My Inbox
              </Button>
            </Link>
            <Link href="/support-queue">
              <Button
                variant={isActive('/support-queue') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Support Queue
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Sales Section */}
      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setSalesOpen(!salesOpen)}
        >
          {salesOpen || isSalesChildActive ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <TrendingUp className="h-4 w-4" />
          <span className="font-semibold">Sales</span>
        </Button>

        {(salesOpen || isSalesChildActive) && (
          <div className="ml-6 mt-1 space-y-1">
            <Link href="/follow-ups">
              <Button
                variant={isActive('/follow-ups') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Action Items
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Projects Section */}
      <div className="pt-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setProjectsOpen(!projectsOpen)}
        >
          {projectsOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <FolderKanban className="h-4 w-4" />
          <span className="font-semibold">Projects</span>
        </Button>

        {projectsOpen && (
          <div className="ml-6 mt-1 space-y-1">
            <Link href="/work-items">
              <Button
                variant={isActive('/work-items') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                All Projects
              </Button>
            </Link>
            <Link href="/customify-orders">
              <Button
                variant={isActive('/customify-orders') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Customify Review
              </Button>
            </Link>
            <Link href="/custom-design-queue">
              <Button
                variant={isActive('/custom-design-queue') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Assisted Projects
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Batches */}
      <Link href="/batches">
        <Button
          variant={isActive('/batches') ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start gap-3"
        >
          <Package className="h-4 w-4" />
          Batches
        </Button>
      </Link>

      {/* Stuck Items */}
      <Link href="/stuck-items">
        <Button
          variant={isActive('/stuck-items') ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start gap-3"
        >
          <AlertTriangle className="h-4 w-4" />
          Stuck Items
        </Button>
      </Link>

      {/* Settings */}
      <div className="pt-4">
        <Link href="/settings">
          <Button
            variant={isActive('/settings') ? 'secondary' : 'ghost'}
            size="sm"
            className="w-full justify-start gap-3"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </Link>
      </div>
    </nav>
  )
}
