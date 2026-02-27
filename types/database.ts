export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type WorkItemType = 'customify_order' | 'assisted_project'
export type WorkItemSource = 'shopify' | 'email' | 'form' | 'manual'
export type Priority = 'low' | 'normal' | 'high'
export type DesignReviewStatus = 'pending' | 'approved' | 'needs_fix'
export type CommunicationDirection = 'inbound' | 'outbound'
export type TriageStatus = 'untriaged' | 'triaged' | 'created_lead' | 'attached' | 'flagged_support' | 'archived'
export type EmailCategory = 'primary' | 'promotional' | 'spam' | 'notifications'
export type EmailPriority = 'high' | 'medium' | 'low'
export type EmailStatus = 'needs_reply' | 'waiting_on_customer' | 'closed'
export type FileKind = 'preview' | 'design' | 'proof' | 'other' | 'email_attachment'
export type BatchStatus = 'draft' | 'confirmed' | 'exported'
export type IntegrationProvider = 'shopify' | 'm365'
export type IntegrationStatus = 'connected' | 'disconnected' | 'error'
export type WebhookProcessingStatus = 'received' | 'processed' | 'failed'
export type RoleKey = 'admin' | 'ops' | 'support'

// Customify Order Statuses
export type CustomifyOrderStatus =
  | 'needs_design_review'
  | 'needs_customer_fix'
  | 'approved'
  | 'ready_for_batch'
  | 'batched'
  | 'shipped'
  | 'closed'

// Assisted Project Statuses
export type AssistedProjectStatus =
  | 'new_inquiry'
  | 'info_sent'
  | 'future_event_monitoring'
  | 'design_fee_sent'
  | 'design_fee_paid'
  | 'in_design'
  | 'proof_sent'
  | 'awaiting_approval'
  | 'invoice_sent'
  | 'awaiting_customer_files'
  | 'deposit_paid_ready_for_batch'
  | 'on_payment_terms_ready_for_batch'
  | 'paid_ready_for_batch'
  | 'closed_won'
  | 'closed_lost'
  | 'closed_event_cancelled'

export type WorkItemStatus = CustomifyOrderStatus | AssistedProjectStatus

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: string
          key: RoleKey
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: RoleKey
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: RoleKey
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          email: string | null
          first_name: string | null
          last_name: string | null
          display_name: string | null
          phone: string | null
          shopify_customer_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          display_name?: string | null
          phone?: string | null
          shopify_customer_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          display_name?: string | null
          phone?: string | null
          shopify_customer_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_items: {
        Row: {
          id: string
          type: WorkItemType
          source: WorkItemSource
          title: string | null
          customer_id: string | null
          customer_name: string | null
          customer_email: string | null
          alternate_emails: string[] | null
          customer_providing_artwork: boolean
          shopify_order_id: string | null
          shopify_draft_order_id: string | null
          shopify_order_number: string | null
          design_fee_order_id: string | null
          design_fee_order_number: string | null
          shopify_financial_status: string | null
          shopify_fulfillment_status: string | null
          status: WorkItemStatus
          priority: Priority
          quantity: number | null
          grip_color: string | null
          event_date: string | null
          due_date: string | null
          ship_by_date: string | null
          design_review_status: DesignReviewStatus
          design_preview_url: string | null
          design_download_url: string | null
          last_contact_at: string | null
          next_follow_up_at: string | null
          follow_up_cadence_key: string | null
          requires_initial_contact: boolean
          rush_order: boolean
          missed_design_window: boolean
          is_waiting: boolean
          assigned_to_user_id: string | null
          ready_for_batch_at: string | null
          batched_at: string | null
          batch_id: string | null
          closed_at: string | null
          close_reason: string | null
          reason_included: Json | null
          revision_count: number
          proof_sent_at: string | null
          proof_approved_at: string | null
          customer_feedback: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: WorkItemType
          source: WorkItemSource
          title?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_email?: string | null
          alternate_emails?: string[] | null
          customer_providing_artwork?: boolean
          shopify_order_id?: string | null
          shopify_draft_order_id?: string | null
          shopify_order_number?: string | null
          design_fee_order_id?: string | null
          design_fee_order_number?: string | null
          shopify_financial_status?: string | null
          shopify_fulfillment_status?: string | null
          status: WorkItemStatus
          priority?: Priority
          quantity?: number | null
          grip_color?: string | null
          event_date?: string | null
          due_date?: string | null
          ship_by_date?: string | null
          design_review_status?: DesignReviewStatus
          design_preview_url?: string | null
          design_download_url?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          follow_up_cadence_key?: string | null
          requires_initial_contact?: boolean
          rush_order?: boolean
          missed_design_window?: boolean
          is_waiting?: boolean
          assigned_to_user_id?: string | null
          ready_for_batch_at?: string | null
          batched_at?: string | null
          batch_id?: string | null
          closed_at?: string | null
          close_reason?: string | null
          reason_included?: Json | null
          revision_count?: number
          proof_sent_at?: string | null
          proof_approved_at?: string | null
          customer_feedback?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: WorkItemType
          source?: WorkItemSource
          title?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_email?: string | null
          alternate_emails?: string[] | null
          customer_providing_artwork?: boolean
          shopify_order_id?: string | null
          shopify_draft_order_id?: string | null
          shopify_order_number?: string | null
          design_fee_order_id?: string | null
          design_fee_order_number?: string | null
          shopify_financial_status?: string | null
          shopify_fulfillment_status?: string | null
          status?: WorkItemStatus
          priority?: Priority
          quantity?: number | null
          grip_color?: string | null
          event_date?: string | null
          due_date?: string | null
          ship_by_date?: string | null
          design_review_status?: DesignReviewStatus
          design_preview_url?: string | null
          design_download_url?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          follow_up_cadence_key?: string | null
          requires_initial_contact?: boolean
          rush_order?: boolean
          missed_design_window?: boolean
          is_waiting?: boolean
          assigned_to_user_id?: string | null
          ready_for_batch_at?: string | null
          batched_at?: string | null
          batch_id?: string | null
          closed_at?: string | null
          close_reason?: string | null
          reason_included?: Json | null
          revision_count?: number
          proof_sent_at?: string | null
          proof_approved_at?: string | null
          customer_feedback?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      work_item_status_events: {
        Row: {
          id: string
          work_item_id: string
          from_status: string | null
          to_status: string
          changed_by_user_id: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_item_id: string
          from_status?: string | null
          to_status: string
          changed_by_user_id?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_item_id?: string
          from_status?: string | null
          to_status?: string
          changed_by_user_id?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      communications: {
        Row: {
          id: string
          work_item_id: string | null
          customer_id: string | null
          provider: string
          provider_message_id: string | null
          provider_thread_id: string | null
          internet_message_id: string | null
          direction: CommunicationDirection
          from_email: string
          to_emails: string[]
          cc_emails: string[] | null
          subject: string | null
          body_preview: string | null
          body_html: string | null
          has_attachments: boolean
          attachments_meta: Json | null
          triage_status: TriageStatus
          category: EmailCategory
          is_read: boolean
          actioned_at: string | null
          sent_at: string | null
          received_at: string | null
          owner_user_id: string | null
          priority: EmailPriority
          email_status: EmailStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_item_id?: string | null
          customer_id?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_thread_id?: string | null
          internet_message_id?: string | null
          direction: CommunicationDirection
          from_email: string
          to_emails: string[]
          cc_emails?: string[] | null
          subject?: string | null
          body_preview?: string | null
          body_html?: string | null
          has_attachments?: boolean
          attachments_meta?: Json | null
          triage_status?: TriageStatus
          category?: EmailCategory
          is_read?: boolean
          actioned_at?: string | null
          sent_at?: string | null
          received_at?: string | null
          owner_user_id?: string | null
          priority?: EmailPriority
          email_status?: EmailStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_item_id?: string | null
          customer_id?: string | null
          provider?: string
          provider_message_id?: string | null
          provider_thread_id?: string | null
          internet_message_id?: string | null
          direction?: CommunicationDirection
          from_email?: string
          to_emails?: string[]
          cc_emails?: string[] | null
          subject?: string | null
          body_preview?: string | null
          body_html?: string | null
          has_attachments?: boolean
          attachments_meta?: Json | null
          triage_status?: TriageStatus
          category?: EmailCategory
          is_read?: boolean
          actioned_at?: string | null
          sent_at?: string | null
          received_at?: string | null
          owner_user_id?: string | null
          priority?: EmailPriority
          email_status?: EmailStatus
          created_at?: string
          updated_at?: string
        }
      }
      email_filters: {
        Row: {
          id: string
          sender_email: string | null
          sender_domain: string | null
          category: EmailCategory
          auto_archive: boolean
          created_by_user_id: string | null
          is_active: boolean
          match_count: number
          last_matched_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_email?: string | null
          sender_domain?: string | null
          category: EmailCategory
          auto_archive?: boolean
          created_by_user_id?: string | null
          is_active?: boolean
          match_count?: number
          last_matched_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_email?: string | null
          sender_domain?: string | null
          category?: EmailCategory
          auto_archive?: boolean
          created_by_user_id?: string | null
          is_active?: boolean
          match_count?: number
          last_matched_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          key: string
          name: string
          subject_template: string
          body_html_template: string
          merge_fields: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          name: string
          subject_template: string
          body_html_template: string
          merge_fields: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          name?: string
          subject_template?: string
          body_html_template?: string
          merge_fields?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      files: {
        Row: {
          id: string
          work_item_id: string | null
          communication_id: string | null
          kind: FileKind
          version: number
          original_filename: string
          normalized_filename: string | null
          storage_bucket: string
          storage_path: string
          external_url: string | null
          mime_type: string | null
          size_bytes: number | null
          uploaded_by_user_id: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_item_id?: string | null
          communication_id?: string | null
          kind: FileKind
          version?: number
          original_filename: string
          normalized_filename?: string | null
          storage_bucket: string
          storage_path: string
          external_url?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by_user_id?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_item_id?: string | null
          communication_id?: string | null
          kind?: FileKind
          version?: number
          original_filename?: string
          normalized_filename?: string | null
          storage_bucket?: string
          storage_path?: string
          external_url?: string | null
          mime_type?: string | null
          size_bytes?: number | null
          uploaded_by_user_id?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      batches: {
        Row: {
          id: string
          name: string
          status: BatchStatus
          created_by_user_id: string | null
          confirmed_at: string | null
          exported_at: string | null
          tracking_number: string | null
          shipped_at: string | null
          notes: string | null
          alibaba_order_number: string | null
          drip_email_1_sent_at: string | null
          drip_email_2_sent_at: string | null
          drip_email_3_sent_at: string | null
          drip_email_4_sent_at: string | null
          drip_email_4_skipped: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          status?: BatchStatus
          created_by_user_id?: string | null
          confirmed_at?: string | null
          exported_at?: string | null
          tracking_number?: string | null
          shipped_at?: string | null
          notes?: string | null
          alibaba_order_number?: string | null
          drip_email_1_sent_at?: string | null
          drip_email_2_sent_at?: string | null
          drip_email_3_sent_at?: string | null
          drip_email_4_sent_at?: string | null
          drip_email_4_skipped?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          status?: BatchStatus
          created_by_user_id?: string | null
          confirmed_at?: string | null
          exported_at?: string | null
          tracking_number?: string | null
          shipped_at?: string | null
          notes?: string | null
          alibaba_order_number?: string | null
          drip_email_1_sent_at?: string | null
          drip_email_2_sent_at?: string | null
          drip_email_3_sent_at?: string | null
          drip_email_4_sent_at?: string | null
          drip_email_4_skipped?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      batch_items: {
        Row: {
          id: string
          batch_id: string
          work_item_id: string
          position: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          batch_id: string
          work_item_id: string
          position?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          batch_id?: string
          work_item_id?: string
          position?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      integration_accounts: {
        Row: {
          id: string
          provider: IntegrationProvider
          display_name: string
          status: IntegrationStatus
          scopes: string[] | null
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider: IntegrationProvider
          display_name: string
          status?: IntegrationStatus
          scopes?: string[] | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider?: IntegrationProvider
          display_name?: string
          status?: IntegrationStatus
          scopes?: string[] | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      webhook_events: {
        Row: {
          id: string
          provider: IntegrationProvider
          event_type: string
          external_event_id: string | null
          payload: Json
          received_at: string
          processed_at: string | null
          processing_status: WebhookProcessingStatus
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider: IntegrationProvider
          event_type: string
          external_event_id?: string | null
          payload: Json
          received_at?: string
          processed_at?: string | null
          processing_status?: WebhookProcessingStatus
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider?: IntegrationProvider
          event_type?: string
          external_event_id?: string | null
          payload?: Json
          received_at?: string
          processed_at?: string | null
          processing_status?: WebhookProcessingStatus
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

// ============================================================================
// Shopify Integration Types (Phase 1-3)
// ============================================================================

export type OrderType = 'customify_order' | 'custom_design_service' | 'custom_bulk_order'
export type MatchType = 'exact' | 'contains' | 'regex'
export type SyncType = 'customer_note' | 'customer_tags' | 'order_fulfillment' | 'order_metafield'
export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type ShopifyResourceType = 'customer' | 'order' | 'fulfillment'

/**
 * Payment event structure for payment_history JSONB field
 * Tracks individual payment transactions from Shopify
 */
export interface PaymentEvent {
  transaction_id?: string
  amount: number
  currency: string
  status: string
  kind: string // 'sale', 'capture', 'refund', etc.
  gateway?: string
  paid_at?: string
}

/**
 * Customer Order record - tracks unlimited orders per customer
 * Separates order tracking from production work items
 */
export interface CustomerOrder {
  id: string
  customer_id: string | null
  work_item_id: string | null
  shopify_order_id: string
  shopify_order_number: string
  shopify_customer_id: string | null
  order_type: OrderType
  total_price: number | null
  currency: string
  financial_status: string | null
  fulfillment_status: string | null
  payment_history: PaymentEvent[]
  tags: string[]
  note: string | null
  line_items: Json
  shopify_created_at: string | null
  shopify_updated_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Shopify Sync Queue Item - tracks bi-directional sync operations
 * Implements retry logic with exponential backoff
 */
export interface ShopifySyncQueueItem {
  id: string
  sync_type: SyncType
  shopify_resource_type: ShopifyResourceType
  shopify_resource_id: string
  sync_payload: Record<string, any>
  work_item_id: string | null
  customer_id: string | null
  status: SyncStatus
  retry_count: number
  max_retries: number
  next_retry_at: string | null
  last_retry_at: string | null
  shopify_response: Json | null
  error_message: string | null
  error_code: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Shopify Tag Mapping - maps Shopify customer tags to internal tags
 * Supports exact match, contains, and regex patterns
 */
export interface ShopifyTagMapping {
  id: string
  shopify_tag_pattern: string
  internal_tag_id: string
  match_type: MatchType
  is_active: boolean
  created_at: string
  updated_at: string
}
