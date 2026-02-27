'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Mail,
  Users,
  FolderKanban,
  Package,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

export function SidebarNavigation() {
  const pathname = usePathname()
  const [projectsOpen, setProjectsOpen] = useState(true)

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/')
  }

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

      {/* Customers - Primary customer-centric view */}
      <Link href="/customers">
        <Button
          variant={isActive('/customers') ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start gap-3"
        >
          <Users className="h-4 w-4" />
          Customers
        </Button>
      </Link>

      {/* Inbox */}
      <Link href="/inbox/my-inbox">
        <Button
          variant={isActive('/inbox') ? 'secondary' : 'ghost'}
          size="sm"
          className="w-full justify-start gap-3"
        >
          <Mail className="h-4 w-4" />
          Inbox
        </Button>
      </Link>

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
                Customify Orders
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
            <Link href="/approved-designs">
              <Button
                variant={isActive('/approved-designs') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Ready to Batch
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
