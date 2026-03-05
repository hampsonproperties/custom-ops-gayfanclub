import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href: string
  icon?: LucideIcon
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  current: string
}

export function Breadcrumbs({ items, current }: BreadcrumbsProps) {
  return (
    <div className="flex items-center gap-3">
      {items.map((item, i) => (
        <span key={item.href} className="contents">
          <Link href={item.href}>
            <Button variant="ghost" size="sm" className="gap-2">
              {i === 0 && !item.icon && <ArrowLeft className="h-4 w-4" />}
              {item.icon && <item.icon className="h-4 w-4" />}
              {item.label}
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
        </span>
      ))}
      <span className="text-sm font-medium truncate">{current}</span>
    </div>
  )
}
