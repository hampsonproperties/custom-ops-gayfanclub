import { Badge } from "@/components/ui/badge"
import { Clock, AlertCircle, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type SLAState = "overdue" | "expiring" | "on_track" | "new"

interface SLAIndicatorProps {
  state: SLAState
  label?: string
  className?: string
}

const slaConfig: Record<SLAState, { icon: typeof Clock; className: string; defaultLabel: string }> = {
  overdue: {
    icon: AlertCircle,
    className: "bg-[#E91E63] text-white hover:bg-[#C2185B]",
    defaultLabel: "OVERDUE"
  },
  expiring: {
    icon: Clock,
    className: "bg-[#FFC107] text-black hover:bg-[#FFA000]",
    defaultLabel: "EXPIRING"
  },
  on_track: {
    icon: CheckCircle,
    className: "bg-[#4CAF50] text-white hover:bg-[#388E3C]",
    defaultLabel: "ON TRACK"
  },
  new: {
    icon: CheckCircle,
    className: "bg-[#9C27B0] text-white hover:bg-[#7B1FA2]",
    defaultLabel: "NEW"
  }
}

export function SLAIndicator({ state, label, className }: SLAIndicatorProps) {
  const config = slaConfig[state]
  const Icon = config.icon
  const displayLabel = label || config.defaultLabel

  return (
    <Badge className={cn(config.className, "font-medium gap-1", className)}>
      <Icon className="h-3 w-3" />
      {displayLabel}
    </Badge>
  )
}
