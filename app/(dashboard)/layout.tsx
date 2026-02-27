import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RainbowHeader } from '@/components/custom/rainbow-header'
import { EmailSubscriptionManager } from '@/components/email/subscription-manager'
import { CommandPalette } from '@/components/search/command-palette'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Inbox,
  ClipboardCheck,
  CheckCircle2,
  Mail,
  Flag,
  Package,
  Settings,
  LogOut,
  Palette,
  Download,
  Beaker,
  Bell,
  MailCheck,
  AlertTriangle,
  Target,
  Clock,
  Building2
} from 'lucide-react'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user details from users table
  const { data: userData } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const handleSignOut = async () => {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <EmailSubscriptionManager />
      <CommandPalette />
      <RainbowHeader />

      <div className="flex flex-1">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r bg-card flex flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center gap-2 px-6 border-b">
            <span className="text-2xl">🌈</span>
            <h1 className="text-xl font-bold">Custom Ops</h1>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-1">
            {/* Primary */}
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>

            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Sales & Leads
              </p>
            </div>

            <Link href="/sales-leads">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Target className="h-4 w-4" />
                Sales Leads
              </Button>
            </Link>
            <Link href="/follow-ups">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Clock className="h-4 w-4" />
                Follow-Ups
              </Button>
            </Link>
            <Link href="/retail-accounts">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Building2 className="h-4 w-4" />
                Retail Accounts
              </Button>
            </Link>
            <Link href="/inbox/my-inbox">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <MailCheck className="h-4 w-4" />
                My Inbox
              </Button>
            </Link>
            <Link href="/inbox">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Mail className="h-4 w-4" />
                Email Triage
              </Button>
            </Link>

            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Design
              </p>
            </div>

            <Link href="/design-projects">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Palette className="h-4 w-4" />
                My Design Projects
              </Button>
            </Link>

            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Production
              </p>
            </div>

            <Link href="/work-items">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Inbox className="h-4 w-4" />
                All Projects
              </Button>
            </Link>
            <Link href="/design-queue">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <ClipboardCheck className="h-4 w-4" />
                Design Review
              </Button>
            </Link>
            <Link href="/custom-design-queue">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Palette className="h-4 w-4" />
                Custom Designs
              </Button>
            </Link>
            <Link href="/approved-designs">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <CheckCircle2 className="h-4 w-4" />
                Approved Designs
              </Button>
            </Link>
            <Link href="/batches">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Package className="h-4 w-4" />
                Batches
              </Button>
            </Link>

            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                System
              </p>
            </div>

            <Link href="/stuck-items">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <AlertTriangle className="h-4 w-4" />
                Stuck Items
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="w-full justify-start gap-3">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          </nav>

          {/* User Section */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userData?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{userData?.email}</p>
              </div>
            </div>
            <form action={handleSignOut}>
              <Button variant="outline" size="sm" className="w-full gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
