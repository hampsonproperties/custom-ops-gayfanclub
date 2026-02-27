'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Mail, FolderKanban, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { SidebarNavigation } from './sidebar-navigation'

export function MobileBottomNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(path + '/')
  }

  return (
    <>
      {/* Mobile Bottom Navigation - Fixed at bottom */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
        <nav className="flex items-center justify-around h-16 px-2">
          {/* Inbox */}
          <Link href="/inbox/my-inbox" className="flex-1">
            <Button
              variant={isActive('/inbox') ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full flex flex-col items-center gap-1 h-14"
            >
              <Mail className="h-5 w-5" />
              <span className="text-xs">Inbox</span>
            </Button>
          </Link>

          {/* Dashboard */}
          <Link href="/dashboard" className="flex-1">
            <Button
              variant={isActive('/dashboard') ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full flex flex-col items-center gap-1 h-14"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-xs">Dashboard</span>
            </Button>
          </Link>

          {/* Projects */}
          <Link href="/work-items" className="flex-1">
            <Button
              variant={isActive('/work-items') || isActive('/custom') || isActive('/approved') ? 'secondary' : 'ghost'}
              size="sm"
              className="w-full flex flex-col items-center gap-1 h-14"
            >
              <FolderKanban className="h-5 w-5" />
              <span className="text-xs">Projects</span>
            </Button>
          </Link>

          {/* More Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 flex flex-col items-center gap-1 h-14"
              >
                <Menu className="h-5 w-5" />
                <span className="text-xs">More</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <SheetHeader className="h-16 flex items-center px-6 border-b">
                <SheetTitle className="text-xl font-bold">Menu</SheetTitle>
              </SheetHeader>
              <SidebarNavigation />
            </SheetContent>
          </Sheet>
        </nav>
      </div>

      {/* Spacer to prevent content being hidden behind bottom nav */}
      <div className="md:hidden h-16" />
    </>
  )
}
