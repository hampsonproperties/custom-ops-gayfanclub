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
  TrendingUp,
  Clock,
  AlertTriangle,
  Palette,
  Building2,
  Inbox,
  HelpCircle,
} from 'lucide-react'

export function SidebarNavigation() {
  const pathname = usePathname()
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [salesOpen, setSalesOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/')
  }

  // Auto-open sections when a child is active
  const isSalesChildActive = isActive('/sales-leads') || isActive('/follow-ups') || isActive('/retail-accounts')
  const isEmailChildActive = isActive('/email-intake') || isActive('/support-queue')

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
            <Link href="/email-intake">
              <Button
                variant={isActive('/email-intake') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Email Intake
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
            <Link href="/design-queue">
              <Button
                variant={isActive('/design-queue') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Design Review
              </Button>
            </Link>
            <Link href="/design-projects">
              <Button
                variant={isActive('/design-projects') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Design Projects
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
            <Link href="/sales-leads">
              <Button
                variant={isActive('/sales-leads') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Sales Leads
              </Button>
            </Link>
            <Link href="/follow-ups">
              <Button
                variant={isActive('/follow-ups') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Follow-ups
              </Button>
            </Link>
            <Link href="/retail-accounts">
              <Button
                variant={isActive('/retail-accounts') ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-sm"
              >
                Retail Accounts
              </Button>
            </Link>
          </div>
        )}
      </div>

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
