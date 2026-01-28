import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RainbowHeader } from '@/components/custom/rainbow-header'
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
  LogOut
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
      <RainbowHeader />

      {/* Top Navigation */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌈</span>
            <h1 className="text-xl font-bold">Custom Ops</h1>
          </div>

          <nav className="flex items-center gap-1">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/work-items">
              <Button variant="ghost" size="sm" className="gap-2">
                <Inbox className="h-4 w-4" />
                Work Items
              </Button>
            </Link>
            <Link href="/design-queue">
              <Button variant="ghost" size="sm" className="gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Design Queue
              </Button>
            </Link>
            <Link href="/approved-designs">
              <Button variant="ghost" size="sm" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Approved Designs
              </Button>
            </Link>
            <Link href="/email-intake">
              <Button variant="ghost" size="sm" className="gap-2">
                <Mail className="h-4 w-4" />
                Email Intake
              </Button>
            </Link>
            <Link href="/support-queue">
              <Button variant="ghost" size="sm" className="gap-2">
                <Flag className="h-4 w-4" />
                Support Queue
              </Button>
            </Link>
            <Link href="/batches">
              <Button variant="ghost" size="sm" className="gap-2">
                <Package className="h-4 w-4" />
                Batches
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{userData?.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{userData?.email}</p>
            </div>
            <form action={handleSignOut}>
              <Button variant="ghost" size="sm" className="gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
