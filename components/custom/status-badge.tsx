import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Customify Order Statuses
  needs_design_review: { label: "Needs Review", className: "bg-[#9C27B0] text-white hover:bg-[#7B1FA2]" },
  needs_customer_fix: { label: "Needs Fix", className: "bg-[#FF9800] text-white hover:bg-[#F57C00]" },
  approved: { label: "Approved", className: "bg-[#4CAF50] text-white hover:bg-[#388E3C]" },
  ready_for_batch: { label: "Ready for Batch", className: "bg-[#00BCD4] text-white hover:bg-[#0097A7]" },
  batched: { label: "Batched", className: "bg-[#607D8B] text-white hover:bg-[#455A64]" },
  shipped: { label: "Shipped", className: "bg-[#4CAF50] text-white hover:bg-[#388E3C]" },
  closed: { label: "Closed", className: "bg-gray-400 text-white hover:bg-gray-500" },

  // Assisted Project Statuses
  new_inquiry: { label: "New Inquiry", className: "bg-[#9C27B0] text-white hover:bg-[#7B1FA2]" },
  info_sent: { label: "Info Sent", className: "bg-[#00BCD4] text-white hover:bg-[#0097A7]" },
  future_event_monitoring: { label: "Monitoring Event", className: "bg-[#FFC107] text-black hover:bg-[#FFA000]" },
  design_fee_sent: { label: "Fee Sent", className: "bg-[#FF9800] text-white hover:bg-[#F57C00]" },
  design_fee_paid: { label: "Fee Paid", className: "bg-[#4CAF50] text-white hover:bg-[#388E3C]" },
  in_design: { label: "In Design", className: "bg-[#2196F3] text-white hover:bg-[#1976D2]" },
  proof_sent: { label: "Proof Sent", className: "bg-[#00BCD4] text-white hover:bg-[#0097A7]" },
  awaiting_approval: { label: "Awaiting Approval", className: "bg-[#FF9800] text-white hover:bg-[#F57C00]" },
  invoice_sent: { label: "Invoice Sent", className: "bg-[#FF9800] text-white hover:bg-[#F57C00]" },
  on_payment_terms_ready_for_batch: { label: "On Terms - Ready", className: "bg-[#FFC107] text-black hover:bg-[#FFA000]" },
  paid_ready_for_batch: { label: "Paid - Ready", className: "bg-[#4CAF50] text-white hover:bg-[#388E3C]" },
  closed_won: { label: "Closed - Won", className: "bg-[#4CAF50] text-white hover:bg-[#388E3C]" },
  closed_lost: { label: "Closed - Lost", className: "bg-gray-400 text-white hover:bg-gray-500" },
  closed_event_cancelled: { label: "Cancelled", className: "bg-gray-400 text-white hover:bg-gray-500" },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "bg-gray-200 text-gray-800" }

  return (
    <Badge className={cn(config.className, "font-medium", className)}>
      {config.label}
    </Badge>
  )
}
