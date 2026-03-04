import { z } from 'zod'

// ============================================================
// Common reusable schemas
// ============================================================

export const uuid = z.string().uuid('Must be a valid UUID')

export const idParams = z.object({ id: uuid })

export const email = z.string().email('Must be a valid email address')

// All valid work item statuses
const CUSTOMIFY_STATUSES = [
  'needs_design_review',
  'needs_customer_fix',
  'approved',
  'ready_for_batch',
  'batched',
  'shipped',
  'closed',
] as const

const ASSISTED_STATUSES = [
  'new_inquiry',
  'info_sent',
  'future_event_monitoring',
  'design_fee_sent',
  'design_fee_paid',
  'in_design',
  'proof_sent',
  'awaiting_approval',
  'invoice_sent',
  'awaiting_customer_files',
  'deposit_paid_ready_for_batch',
  'on_payment_terms_ready_for_batch',
  'paid_ready_for_batch',
  'closed_won',
  'closed_lost',
  'closed_event_cancelled',
] as const

const ALL_STATUSES = [...CUSTOMIFY_STATUSES, ...ASSISTED_STATUSES] as const

export const workItemStatus = z.enum(ALL_STATUSES)

const BATCH_EMAIL_TYPES = [
  'entering_production',
  'midway_checkin',
  'en_route',
  'arrived_stateside',
] as const

export const batchEmailType = z.enum(BATCH_EMAIL_TYPES)

// File upload constraints
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/tiff',
  'image/vnd.adobe.photoshop',
  'application/pdf',
  'application/postscript',
  'application/zip',
  'application/x-zip-compressed',
  'application/illustrator',
] as const

// ============================================================
// Route-specific schemas
// ============================================================

// PATCH /api/projects/[id]/status
export const updateStatusBody = z.object({
  status: workItemStatus,
  note: z.string().max(2000).optional(),
})

// POST /api/request-changes
export const requestChangesBody = z.object({
  token: z.string().min(1, 'Token is required'),
  feedback: z.string().min(1, 'Feedback is required').max(10000),
})

// POST /api/email/send
export const sendEmailBody = z.object({
  to: email,
  cc: z.array(email).optional(),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  customerId: uuid.optional(),
  projectId: uuid.optional(),
})

// POST /api/email/generate
export const generateEmailBody = z.object({
  prompt: z.string().min(1).max(5000),
  projectId: uuid.optional(),
  customerId: uuid.optional(),
  customerEmail: z.string().optional(),
})

// POST /api/send-approval-email & POST /api/preview-approval-email
export const approvalEmailBody = z.object({
  workItemId: uuid,
  fileId: uuid,
})

// POST /api/create-test-order
export const createTestOrderBody = z.object({
  email: email,
})

// POST /api/work-items/[id]/snooze
export const snoozeBody = z.object({
  days: z.number().int().min(1).max(365),
})

// POST /api/work-items/[id]/link-email
export const linkEmailBody = z.object({
  emailId: uuid,
})

// POST /api/work-items/[id]/create-production-invoice
export const createInvoiceBody = z.object({
  amount: z.number().positive().optional(),
  productTitle: z.string().min(1).max(500).optional(),
})

// POST /api/batch-emails/queue
export const queueBatchEmailBody = z.object({
  batchId: uuid,
  workItemId: uuid,
  emailType: batchEmailType,
  recipientEmail: email,
  recipientName: z.string().max(200).optional(),
  scheduledSendAt: z.string().datetime({ message: 'Must be a valid ISO datetime' }),
  expectedBatchStatus: z.string().max(100).optional(),
  expectedHasTracking: z.boolean().optional(),
})

// POST /api/batch-emails/cancel
export const cancelBatchEmailBody = z.object({
  queueId: uuid,
  reason: z.string().max(500).optional(),
})

// POST /api/batches/[id]/mark-received
export const markReceivedBody = z.object({
  receivedAt: z.string().datetime().optional(),
})

// POST /api/shopify/sync/notes
export const syncNotesBody = z.object({
  workItemId: uuid,
  noteId: uuid,
})

// POST /api/shopify/sync/tags
export const syncTagsBody = z.object({
  customerId: uuid,
  tags: z.array(z.string().max(100)).min(1),
})

// POST /api/shopify/sync/fulfillment
export const syncFulfillmentBody = z.object({
  orderId: uuid,
  trackingNumber: z.string().max(200).optional(),
  trackingUrl: z.string().url().optional().or(z.literal('')),
  trackingCompany: z.string().max(200).optional(),
  lineItems: z
    .array(
      z.object({
        id: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
  notifyCustomer: z.boolean().optional(),
})

// POST /api/shopify/search-orders
export const searchOrdersBody = z.object({
  query: z.string().min(1).max(200),
})

// POST /api/shopify/import-single-order
export const importSingleOrderBody = z.object({
  orderId: z.string().min(1).max(50),
})

// POST /api/shopify/import-orders
export const importOrdersBody = z.object({
  orderIds: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

// POST /api/webhooks/reprocess
export const reprocessWebhookBody = z.object({
  webhookId: uuid,
})

// POST /api/email/move-with-filter
export const moveWithFilterBody = z.object({
  fromEmail: email,
  category: z.string().min(1).max(100),
  createFilter: z.boolean().optional(),
})

// POST /api/email/import
export const importEmailsBody = z.object({
  limit: z.number().int().min(1).max(250).optional(),
  daysBack: z.number().int().min(1).max(365).optional(),
})

// POST /api/email/subscribe
export const subscribeEmailBody = z.object({
  notificationUrl: z.string().url(),
})

// DELETE /api/email/subscribe
export const unsubscribeEmailBody = z.object({
  subscriptionId: z.string().min(1).max(200),
})

// POST /api/email/fix-previews
export const fixPreviewsBody = z.object({
  dryRun: z.boolean().optional(),
})

// GET /api/search
export const searchQuery = z.object({
  q: z.string().min(2).max(200),
})

// GET /api/email/recent-unlinked
export const recentUnlinkedQuery = z.object({
  workItemId: uuid,
  customerEmail: email,
})

// GET /api/batch-emails/preview
export const batchEmailPreviewQuery = z.object({
  type: batchEmailType,
  firstName: z.string().max(200).optional(),
})

// GET /api/shopify/get-orders
export const getOrdersQuery = z.object({
  orderIds: z.string().optional(),
  customerId: z.string().optional(),
  email: z.string().optional(),
})

// GET /api/shopify/lookup-customer
export const lookupCustomerQuery = z.object({
  email: email,
})

// ============================================================
// JSONB field schemas (for validating data before DB writes)
// ============================================================

/** work_items.reason_included */
export const reasonIncludedSchema = z.object({
  detected_via: z.string(),
  order_type: z.string().nullish(),
  order_tags: z.string().nullish(),
  has_customify_properties: z.boolean().optional(),
  form_provider: z.string().optional(),
  parsed_fields: z.array(z.string()).optional(),
})

/** communications.attachments_meta */
export const attachmentsMetaSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    contentType: z.string(),
    size: z.number().optional(),
  })
)

/** customer_orders.payment_history */
export const paymentHistorySchema = z.array(
  z.object({
    transaction_id: z.string().nullish(),
    amount: z.string().nullish(),
    currency: z.string().nullish(),
    status: z.string().nullish(),
    kind: z.string().nullish(),
    gateway: z.string().nullish(),
    paid_at: z.string().nullish(),
  })
)

/** shopify_sync_queue.sync_payload — varies by sync_type */
export const syncPayloadNoteSchema = z.object({ note: z.string() })
export const syncPayloadTagsSchema = z.object({ tags: z.union([z.string(), z.array(z.string())]) })
export const syncPayloadFulfillmentSchema = z.object({
  tracking_number: z.string().optional(),
  tracking_url: z.string().optional(),
  tracking_company: z.string().optional(),
  notify_customer: z.boolean().optional(),
  line_items: z.array(z.object({ id: z.string(), quantity: z.number() })).optional(),
})
