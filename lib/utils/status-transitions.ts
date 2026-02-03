import {
  WorkItemType,
  WorkItemStatus,
  CustomifyOrderStatus,
  AssistedProjectStatus,
} from '@/types/database'

// Define workflow order for Customify Orders
const CUSTOMIFY_WORKFLOW: Record<CustomifyOrderStatus, number> = {
  needs_design_review: 1,
  needs_customer_fix: 2,
  approved: 3,
  ready_for_batch: 4,
  batched: 5,
  shipped: 6,
  closed: 7,
}

// Define workflow order for Assisted Projects
const ASSISTED_WORKFLOW: Record<AssistedProjectStatus, number> = {
  new_inquiry: 1,
  info_sent: 2,
  future_event_monitoring: 3,
  design_fee_sent: 4,
  design_fee_paid: 5,
  in_design: 6,
  proof_sent: 7,
  awaiting_approval: 8,
  invoice_sent: 9,
  deposit_paid_ready_for_batch: 10,
  on_payment_terms_ready_for_batch: 10,
  paid_ready_for_batch: 10,
  closed_won: 11,
  closed_lost: 11, // Same level as won - branch point
  closed_event_cancelled: 11, // Same level - branch point
}

// Statuses that can only be set by the system
const SYSTEM_ONLY_STATUSES: WorkItemStatus[] = ['batched', 'shipped']

// Statuses that represent closing
const CLOSING_STATUSES: WorkItemStatus[] = [
  'closed',
  'closed_won',
  'closed_lost',
  'closed_event_cancelled',
]

// Get workflow order for a status
function getWorkflowOrder(status: string, type: WorkItemType): number {
  if (type === 'customify_order') {
    return CUSTOMIFY_WORKFLOW[status as CustomifyOrderStatus] || 999
  } else {
    return ASSISTED_WORKFLOW[status as AssistedProjectStatus] || 999
  }
}

// Get all valid statuses for a work item type
export function getValidStatusesForWorkItem(
  type: WorkItemType
): WorkItemStatus[] {
  if (type === 'customify_order') {
    return Object.keys(CUSTOMIFY_WORKFLOW) as CustomifyOrderStatus[]
  } else {
    return Object.keys(ASSISTED_WORKFLOW) as AssistedProjectStatus[]
  }
}

// Human-readable status labels
export function getStatusLabel(status: WorkItemStatus): string {
  const labels: Record<WorkItemStatus, string> = {
    // Customify Order statuses
    needs_design_review: 'Needs Design Review',
    needs_customer_fix: 'Needs Customer Fix',
    approved: 'Approved',
    ready_for_batch: 'Ready for Batch',
    batched: 'Batched',
    shipped: 'Shipped',
    closed: 'Closed',
    // Assisted Project statuses
    new_inquiry: 'New Inquiry',
    info_sent: 'Info Sent',
    future_event_monitoring: 'Future Event Monitoring',
    design_fee_sent: 'Design Fee Sent',
    design_fee_paid: 'Design Fee Paid',
    in_design: 'In Design',
    proof_sent: 'Proof Sent',
    awaiting_approval: 'Awaiting Approval',
    invoice_sent: 'Invoice Sent',
    deposit_paid_ready_for_batch: 'Deposit Paid - Ready for Batch',
    on_payment_terms_ready_for_batch: 'On Payment Terms - Ready for Batch',
    paid_ready_for_batch: 'Paid - Ready for Batch',
    closed_won: 'Closed (Won)',
    closed_lost: 'Closed (Lost)',
    closed_event_cancelled: 'Closed (Event Cancelled)',
  }
  return labels[status] || status
}

// Analyze a status transition
export interface TransitionAnalysis {
  isBackwards: boolean
  requiresNotes: boolean
  isBlocked: boolean
  blockReason?: string
  warning?: string
}

export function analyzeTransition(
  fromStatus: WorkItemStatus,
  toStatus: WorkItemStatus,
  type: WorkItemType
): TransitionAnalysis {
  // Check if blocked (system-only status)
  if (SYSTEM_ONLY_STATUSES.includes(toStatus)) {
    return {
      isBackwards: false,
      requiresNotes: false,
      isBlocked: true,
      blockReason: `"${getStatusLabel(
        toStatus
      )}" can only be set by the system`,
    }
  }

  const fromOrder = getWorkflowOrder(fromStatus, type)
  const toOrder = getWorkflowOrder(toStatus, type)
  const isBackwards = toOrder < fromOrder
  const isSkipping = toOrder > fromOrder + 1
  const isClosing = CLOSING_STATUSES.includes(toStatus)

  // Determine if notes are required
  const requiresNotes = isBackwards || isClosing || isSkipping

  // Determine warning message
  let warning: string | undefined

  if (isBackwards) {
    warning = 'Moving backwards in the workflow. Please explain why.'
  } else if (isSkipping) {
    warning =
      'Skipping workflow stages. This is unusual - please add a note explaining why.'
  } else if (isClosing) {
    warning = 'This will close the work item. Please provide a closure reason.'
  }

  return {
    isBackwards,
    requiresNotes,
    isBlocked: false,
    warning,
  }
}

// Group statuses for Select dropdown
export interface StatusGroup {
  label: string
  statuses: Array<{
    value: WorkItemStatus
    label: string
    disabled?: boolean
  }>
}

export function getStatusGroups(
  type: WorkItemType,
  currentStatus?: WorkItemStatus
): StatusGroup[] {
  const validStatuses = getValidStatusesForWorkItem(type)

  if (type === 'customify_order') {
    return [
      {
        label: 'Normal Workflow',
        statuses: [
          { value: 'needs_design_review', label: 'Needs Design Review' },
          { value: 'needs_customer_fix', label: 'Needs Customer Fix' },
          { value: 'approved', label: 'Approved' },
          { value: 'ready_for_batch', label: 'Ready for Batch' },
        ],
      },
      {
        label: 'System Managed',
        statuses: [
          {
            value: 'batched',
            label: 'Batched (System Only)',
            disabled: true,
          },
          {
            value: 'shipped',
            label: 'Shipped (System Only)',
            disabled: true,
          },
        ],
      },
      {
        label: 'Closing',
        statuses: [{ value: 'closed', label: 'Closed' }],
      },
    ]
  } else {
    // assisted_project
    return [
      {
        label: 'Inquiry & Quoting',
        statuses: [
          { value: 'new_inquiry', label: 'New Inquiry' },
          { value: 'info_sent', label: 'Info Sent' },
          { value: 'future_event_monitoring', label: 'Future Event Monitoring' },
          { value: 'design_fee_sent', label: 'Design Fee Sent' },
          { value: 'design_fee_paid', label: 'Design Fee Paid' },
        ],
      },
      {
        label: 'Design & Approval',
        statuses: [
          { value: 'in_design', label: 'In Design' },
          { value: 'proof_sent', label: 'Proof Sent' },
          { value: 'awaiting_approval', label: 'Awaiting Approval' },
        ],
      },
      {
        label: 'Payment & Production',
        statuses: [
          { value: 'invoice_sent', label: 'Invoice Sent' },
          { value: 'deposit_paid_ready_for_batch', label: 'Deposit Paid - Ready for Batch' },
          { value: 'on_payment_terms_ready_for_batch', label: 'On Payment Terms - Ready for Batch' },
          { value: 'paid_ready_for_batch', label: 'Paid - Ready for Batch' },
        ],
      },
      {
        label: 'Closing',
        statuses: [
          { value: 'closed_won', label: 'Closed (Won)' },
          { value: 'closed_lost', label: 'Closed (Lost)' },
          { value: 'closed_event_cancelled', label: 'Closed (Event Cancelled)' },
        ],
      },
    ]
  }
}
