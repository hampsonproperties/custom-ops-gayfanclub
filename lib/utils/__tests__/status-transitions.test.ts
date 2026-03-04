import { describe, it, expect } from 'vitest'
import {
  getValidStatusesForWorkItem,
  getStatusLabel,
  analyzeTransition,
  getStatusGroups,
} from '../status-transitions'

describe('getValidStatusesForWorkItem', () => {
  it('returns 7 statuses for customify_order', () => {
    const statuses = getValidStatusesForWorkItem('customify_order')
    expect(statuses).toHaveLength(7)
    expect(statuses).toContain('needs_design_review')
    expect(statuses).toContain('approved')
    expect(statuses).toContain('batched')
    expect(statuses).toContain('shipped')
    expect(statuses).toContain('closed')
  })

  it('returns 16 statuses for assisted_project', () => {
    const statuses = getValidStatusesForWorkItem('assisted_project')
    expect(statuses).toHaveLength(16)
    expect(statuses).toContain('new_inquiry')
    expect(statuses).toContain('in_design')
    expect(statuses).toContain('closed_won')
    expect(statuses).toContain('closed_lost')
  })

  it('customify statuses do not include assisted-only statuses', () => {
    const statuses = getValidStatusesForWorkItem('customify_order')
    expect(statuses).not.toContain('new_inquiry')
    expect(statuses).not.toContain('closed_won')
  })

  it('assisted statuses do not include customify-only statuses', () => {
    const statuses = getValidStatusesForWorkItem('assisted_project')
    expect(statuses).not.toContain('needs_design_review')
    expect(statuses).not.toContain('needs_customer_fix')
  })
})

describe('getStatusLabel', () => {
  it('returns human-readable label for known status', () => {
    expect(getStatusLabel('needs_design_review')).toBe('Needs Design Review')
    expect(getStatusLabel('new_inquiry')).toBe('New Inquiry')
    expect(getStatusLabel('closed_won')).toBe('Closed (Won)')
    expect(getStatusLabel('deposit_paid_ready_for_batch')).toBe('Deposit Paid - Ready for Batch')
  })

  it('returns the raw status string for unknown status', () => {
    expect(getStatusLabel('unknown_status' as any)).toBe('unknown_status')
  })
})

describe('analyzeTransition', () => {
  // ── Forward transitions (normal) ──

  it('normal forward step does not require notes', () => {
    const result = analyzeTransition('needs_design_review', 'needs_customer_fix', 'customify_order')
    expect(result.isBackwards).toBe(false)
    expect(result.requiresNotes).toBe(false)
    expect(result.isBlocked).toBe(false)
    expect(result.warning).toBeUndefined()
  })

  it('assisted project forward step works', () => {
    const result = analyzeTransition('new_inquiry', 'info_sent', 'assisted_project')
    expect(result.isBackwards).toBe(false)
    expect(result.requiresNotes).toBe(false)
    expect(result.isBlocked).toBe(false)
  })

  // ── Backward transitions ──

  it('backward transition requires notes and warns', () => {
    const result = analyzeTransition('approved', 'needs_design_review', 'customify_order')
    expect(result.isBackwards).toBe(true)
    expect(result.requiresNotes).toBe(true)
    expect(result.warning).toContain('backwards')
  })

  it('backward assisted project transition detected', () => {
    const result = analyzeTransition('in_design', 'design_fee_paid', 'assisted_project')
    expect(result.isBackwards).toBe(true)
    expect(result.requiresNotes).toBe(true)
  })

  // ── Skipping transitions ──

  it('skipping workflow stages requires notes and warns', () => {
    const result = analyzeTransition('needs_design_review', 'ready_for_batch', 'customify_order')
    expect(result.requiresNotes).toBe(true)
    expect(result.warning).toContain('Skipping')
  })

  it('skipping multiple assisted stages requires notes', () => {
    const result = analyzeTransition('new_inquiry', 'in_design', 'assisted_project')
    expect(result.requiresNotes).toBe(true)
    expect(result.warning).toContain('Skipping')
  })

  // ── System-only statuses (blocked) ──

  it('blocks transition to batched (system-only)', () => {
    const result = analyzeTransition('ready_for_batch', 'batched', 'customify_order')
    expect(result.isBlocked).toBe(true)
    expect(result.blockReason).toContain('system')
  })

  it('blocks transition to shipped (system-only)', () => {
    const result = analyzeTransition('batched', 'shipped', 'customify_order')
    expect(result.isBlocked).toBe(true)
    expect(result.blockReason).toContain('system')
  })

  // ── Closing transitions ──

  it('closing a customify order requires notes', () => {
    const result = analyzeTransition('approved', 'closed', 'customify_order')
    expect(result.requiresNotes).toBe(true)
    // From 'approved' (3) to 'closed' (7) is also a skip, so skip warning takes priority
    expect(result.warning).toContain('Skipping')
  })

  it('closing from the previous step shows close warning', () => {
    // From 'shipped' (6) to 'closed' (7) is a single step forward + closing
    const result = analyzeTransition('shipped', 'closed', 'customify_order')
    expect(result.requiresNotes).toBe(true)
    expect(result.warning).toContain('close')
  })

  it('closing an assisted project as won requires notes', () => {
    const result = analyzeTransition('paid_ready_for_batch', 'closed_won', 'assisted_project')
    expect(result.requiresNotes).toBe(true)
    expect(result.warning).toContain('close')
  })

  it('closing an assisted project as lost requires notes', () => {
    const result = analyzeTransition('info_sent', 'closed_lost', 'assisted_project')
    expect(result.requiresNotes).toBe(true)
  })

  it('closing event cancelled requires notes', () => {
    const result = analyzeTransition('design_fee_paid', 'closed_event_cancelled', 'assisted_project')
    expect(result.requiresNotes).toBe(true)
  })

  // ── Parallel statuses ──

  it('parallel statuses (same workflow level) are not backwards', () => {
    // invoice_sent and awaiting_customer_files are both level 9
    const result = analyzeTransition('invoice_sent', 'awaiting_customer_files', 'assisted_project')
    expect(result.isBackwards).toBe(false)
  })

  it('parallel ready-for-batch statuses are not backwards', () => {
    // deposit_paid, on_payment_terms, paid are all level 10
    const result = analyzeTransition('deposit_paid_ready_for_batch', 'paid_ready_for_batch', 'assisted_project')
    expect(result.isBackwards).toBe(false)
  })
})

describe('getStatusGroups', () => {
  it('returns 3 groups for customify_order', () => {
    const groups = getStatusGroups('customify_order')
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.label)).toEqual([
      'Normal Workflow',
      'System Managed',
      'Closing',
    ])
  })

  it('returns 4 groups for assisted_project', () => {
    const groups = getStatusGroups('assisted_project')
    expect(groups).toHaveLength(4)
    expect(groups.map((g) => g.label)).toEqual([
      'Inquiry & Quoting',
      'Design & Approval',
      'Payment & Production',
      'Closing',
    ])
  })

  it('system-managed statuses are disabled', () => {
    const groups = getStatusGroups('customify_order')
    const systemGroup = groups.find((g) => g.label === 'System Managed')
    expect(systemGroup).toBeDefined()
    expect(systemGroup!.statuses.every((s) => s.disabled)).toBe(true)
  })

  it('normal workflow statuses are not disabled', () => {
    const groups = getStatusGroups('customify_order')
    const normalGroup = groups.find((g) => g.label === 'Normal Workflow')
    expect(normalGroup).toBeDefined()
    expect(normalGroup!.statuses.every((s) => !s.disabled)).toBe(true)
  })
})
