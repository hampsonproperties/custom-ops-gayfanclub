import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RainbowHeader } from '@/components/custom/rainbow-header'
import { EmailSubscriptionManager } from '@/components/email/subscription-manager'
import { CommandPalette } from '@/components/search/command-palette'
import { SidebarNavigation } from '@/components/layout/sidebar-navigation'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { FloatingActionButton } from '@/components/layout/floating-action-button'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

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
        {/* Desktop Sidebar Navigation - Hidden on mobile */}
        <aside className="hidden md:flex w-64 border-r bg-card flex-col">
          {/* Logo */}
          <div className="h-16 flex items-center gap-2 px-6 border-b">
            <span className="text-2xl">🌈</span>
            <h1 className="text-xl font-bold">Gay Fan Club</h1>
          </div>

          {/* Navigation Links */}
          <SidebarNavigation />

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
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Floating Action Button */}
      <FloatingActionButton />
    </div>
  )
}
