export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      batch_items: {
        Row: {
          batch_id: string
          created_at: string | null
          id: string
          position: number | null
          updated_at: string | null
          work_item_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string | null
          id?: string
          position?: number | null
          updated_at?: string | null
          work_item_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string | null
          id?: string
          position?: number | null
          updated_at?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          alibaba_order_number: string | null
          confirmed_at: string | null
          created_at: string | null
          created_by_user_id: string | null
          drip_email_1_sent_at: string | null
          drip_email_2_sent_at: string | null
          drip_email_3_sent_at: string | null
          drip_email_4_sent_at: string | null
          drip_email_4_skipped: boolean | null
          exported_at: string | null
          id: string
          name: string
          notes: string | null
          shipped_at: string | null
          status: string | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          alibaba_order_number?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          drip_email_1_sent_at?: string | null
          drip_email_2_sent_at?: string | null
          drip_email_3_sent_at?: string | null
          drip_email_4_sent_at?: string | null
          drip_email_4_skipped?: boolean | null
          exported_at?: string | null
          id?: string
          name: string
          notes?: string | null
          shipped_at?: string | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          alibaba_order_number?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          drip_email_1_sent_at?: string | null
          drip_email_2_sent_at?: string | null
          drip_email_3_sent_at?: string | null
          drip_email_4_sent_at?: string | null
          drip_email_4_skipped?: boolean | null
          exported_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          shipped_at?: string | null
          status?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      communications: {
        Row: {
          actioned_at: string | null
          attachments_meta: Json | null
          body_html: string | null
          body_preview: string | null
          category: string | null
          cc_emails: string[] | null
          conversation_id: string | null
          created_at: string | null
          customer_id: string | null
          direction: string
          email_status: string | null
          from_email: string
          from_name: string | null
          has_attachments: boolean | null
          id: string
          internet_message_id: string | null
          is_read: boolean | null
          manually_tagged: boolean | null
          owner_user_id: string | null
          priority: string | null
          provider: string | null
          provider_message_id: string | null
          provider_thread_id: string | null
          received_at: string | null
          sent_at: string | null
          sent_by_user_id: string | null
          subject: string | null
          to_emails: string[]
          triage_status: string | null
          updated_at: string | null
          work_item_id: string | null
        }
        Insert: {
          actioned_at?: string | null
          attachments_meta?: Json | null
          body_html?: string | null
          body_preview?: string | null
          category?: string | null
          cc_emails?: string[] | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          direction: string
          email_status?: string | null
          from_email: string
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          internet_message_id?: string | null
          is_read?: boolean | null
          manually_tagged?: boolean | null
          owner_user_id?: string | null
          priority?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          received_at?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          subject?: string | null
          to_emails: string[]
          triage_status?: string | null
          updated_at?: string | null
          work_item_id?: string | null
        }
        Update: {
          actioned_at?: string | null
          attachments_meta?: Json | null
          body_html?: string | null
          body_preview?: string | null
          category?: string | null
          cc_emails?: string[] | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          direction?: string
          email_status?: string | null
          from_email?: string
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          internet_message_id?: string | null
          is_read?: boolean | null
          manually_tagged?: boolean | null
          owner_user_id?: string | null
          priority?: string | null
          provider?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          received_at?: string | null
          sent_at?: string | null
          sent_by_user_id?: string | null
          subject?: string | null
          to_emails?: string[]
          triage_status?: string | null
          updated_at?: string | null
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "customer_conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "communications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "unread_conversations"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "communications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_sent_by_user_id_fkey"
            columns: ["sent_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communications_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          customer_id: string | null
          has_unread: boolean | null
          id: string
          is_important: boolean | null
          last_message_at: string | null
          last_message_direction: string | null
          last_message_from: string | null
          message_count: number | null
          provider: string | null
          provider_thread_id: string | null
          status: string | null
          subject: string
          updated_at: string | null
          work_item_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          has_unread?: boolean | null
          id?: string
          is_important?: boolean | null
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_from?: string | null
          message_count?: number | null
          provider?: string | null
          provider_thread_id?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          work_item_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          has_unread?: boolean | null
          id?: string
          is_important?: boolean | null
          last_message_at?: string | null
          last_message_direction?: string | null
          last_message_from?: string | null
          message_count?: number | null
          provider?: string | null
          provider_thread_id?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          customer_id: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean | null
          notes: string | null
          phone: string | null
          receives_emails: boolean | null
          receives_invoices: boolean | null
          role: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          customer_id: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          phone?: string | null
          receives_emails?: boolean | null
          receives_invoices?: boolean | null
          role?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          customer_id?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean | null
          notes?: string | null
          phone?: string | null
          receives_emails?: boolean | null
          receives_invoices?: boolean | null
          role?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          content: string
          created_at: string
          created_by_user_id: string | null
          customer_id: string
          id: string
          is_internal: boolean | null
          starred: boolean | null
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by_user_id?: string | null
          customer_id: string
          id?: string
          is_internal?: boolean | null
          starred?: boolean | null
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by_user_id?: string | null
          customer_id?: string
          id?: string
          is_internal?: boolean | null
          starred?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          created_at: string | null
          currency: string | null
          customer_id: string | null
          financial_status: string | null
          fulfillment_status: string | null
          id: string
          line_items: Json | null
          note: string | null
          order_type: string
          payment_history: Json | null
          shopify_created_at: string | null
          shopify_customer_id: string | null
          shopify_order_id: string
          shopify_order_number: string
          shopify_updated_at: string | null
          tags: string[] | null
          total_price: number | null
          updated_at: string | null
          work_item_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          line_items?: Json | null
          note?: string | null
          order_type: string
          payment_history?: Json | null
          shopify_created_at?: string | null
          shopify_customer_id?: string | null
          shopify_order_id: string
          shopify_order_number: string
          shopify_updated_at?: string | null
          tags?: string[] | null
          total_price?: number | null
          updated_at?: string | null
          work_item_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          line_items?: Json | null
          note?: string | null
          order_type?: string
          payment_history?: Json | null
          shopify_created_at?: string | null
          shopify_customer_id?: string | null
          shopify_order_id?: string
          shopify_order_number?: string
          shopify_updated_at?: string | null
          tags?: string[] | null
          total_price?: number | null
          updated_at?: string | null
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_orders_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          assigned_to_user_id: string | null
          created_at: string | null
          customer_type: string
          display_name: string | null
          email: string | null
          estimated_value: number | null
          first_name: string | null
          first_order_date: string | null
          follow_up_max_touches: number | null
          follow_up_reason: string | null
          follow_up_touch_number: number | null
          id: string
          last_inbound_at: string | null
          last_name: string | null
          last_order_date: string | null
          last_outbound_at: string | null
          metadata: Json | null
          next_follow_up_at: string | null
          notes: string | null
          organization_name: string | null
          phone: string | null
          retail_account_id: string | null
          sales_stage: Database["public"]["Enums"]["sales_stage_enum"]
          shopify_customer_id: string | null
          shopify_last_sync_at: string | null
          tags: string[] | null
          total_order_count: number | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to_user_id?: string | null
          created_at?: string | null
          customer_type?: string
          display_name?: string | null
          email?: string | null
          estimated_value?: number | null
          first_name?: string | null
          first_order_date?: string | null
          follow_up_max_touches?: number | null
          follow_up_reason?: string | null
          follow_up_touch_number?: number | null
          id?: string
          last_inbound_at?: string | null
          last_name?: string | null
          last_order_date?: string | null
          last_outbound_at?: string | null
          metadata?: Json | null
          next_follow_up_at?: string | null
          notes?: string | null
          organization_name?: string | null
          phone?: string | null
          retail_account_id?: string | null
          sales_stage?: Database["public"]["Enums"]["sales_stage_enum"]
          shopify_customer_id?: string | null
          shopify_last_sync_at?: string | null
          tags?: string[] | null
          total_order_count?: number | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to_user_id?: string | null
          created_at?: string | null
          customer_type?: string
          display_name?: string | null
          email?: string | null
          estimated_value?: number | null
          first_name?: string | null
          first_order_date?: string | null
          follow_up_max_touches?: number | null
          follow_up_reason?: string | null
          follow_up_touch_number?: number | null
          id?: string
          last_inbound_at?: string | null
          last_name?: string | null
          last_order_date?: string | null
          last_outbound_at?: string | null
          metadata?: Json | null
          next_follow_up_at?: string | null
          notes?: string | null
          organization_name?: string | null
          phone?: string | null
          retail_account_id?: string | null
          sales_stage?: Database["public"]["Enums"]["sales_stage_enum"]
          shopify_customer_id?: string | null
          shopify_last_sync_at?: string | null
          tags?: string[] | null
          total_order_count?: number | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_retail_account_id_fkey"
            columns: ["retail_account_id"]
            isOneToOne: false
            referencedRelation: "retail_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      dead_letter_queue: {
        Row: {
          alert_channel: string | null
          alerted_at: string | null
          communication_id: string | null
          created_at: string | null
          customer_id: string | null
          error_code: string | null
          error_message: string
          error_stack: string | null
          id: string
          last_retry_at: string | null
          max_retries: number | null
          next_retry_at: string | null
          operation_key: string
          operation_metadata: Json | null
          operation_payload: Json
          operation_type: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          retry_count: number | null
          status: string | null
          updated_at: string | null
          work_item_id: string | null
        }
        Insert: {
          alert_channel?: string | null
          alerted_at?: string | null
          communication_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_code?: string | null
          error_message: string
          error_stack?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          operation_key: string
          operation_metadata?: Json | null
          operation_payload: Json
          operation_type: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
          work_item_id?: string | null
        }
        Update: {
          alert_channel?: string | null
          alerted_at?: string | null
          communication_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_code?: string | null
          error_message?: string
          error_stack?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          operation_key?: string
          operation_metadata?: Json | null
          operation_payload?: Json
          operation_type?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by_user_id?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dead_letter_queue_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "potential_duplicate_emails"
            referencedColumns: ["email_1_id"]
          },
          {
            foreignKeyName: "dead_letter_queue_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "potential_duplicate_emails"
            referencedColumns: ["email_2_id"]
          },
          {
            foreignKeyName: "dead_letter_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_resolved_by_user_id_fkey"
            columns: ["resolved_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      email_filters: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          filter_type: string
          id: string
          is_active: boolean | null
          last_matched_at: string | null
          match_count: number | null
          name: string
          pattern: string
          priority: number | null
          target_category: string | null
          updated_at: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          filter_type: string
          id?: string
          is_active?: boolean | null
          last_matched_at?: string | null
          match_count?: number | null
          name: string
          pattern: string
          priority?: number | null
          target_category?: string | null
          updated_at?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          filter_type?: string
          id?: string
          is_active?: boolean | null
          last_matched_at?: string | null
          match_count?: number | null
          name?: string
          pattern?: string
          priority?: number | null
          target_category?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          last_renewed_at: string | null
          notification_url: string
          resource: string
          status: string | null
          subscription_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          last_renewed_at?: string | null
          notification_url: string
          resource: string
          status?: string | null
          subscription_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          last_renewed_at?: string | null
          notification_url?: string
          resource?: string
          status?: string | null
          subscription_id?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          created_at: string | null
          external_url: string | null
          id: string
          kind: string
          mime_type: string | null
          normalized_filename: string | null
          note: string | null
          original_filename: string
          size_bytes: number | null
          source: string | null
          storage_bucket: string
          storage_path: string
          updated_at: string | null
          uploaded_by_user_id: string | null
          version: number | null
          work_item_id: string
        }
        Insert: {
          created_at?: string | null
          external_url?: string | null
          id?: string
          kind: string
          mime_type?: string | null
          normalized_filename?: string | null
          note?: string | null
          original_filename: string
          size_bytes?: number | null
          source?: string | null
          storage_bucket: string
          storage_path: string
          updated_at?: string | null
          uploaded_by_user_id?: string | null
          version?: number | null
          work_item_id: string
        }
        Update: {
          created_at?: string | null
          external_url?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          normalized_filename?: string | null
          note?: string | null
          original_filename?: string
          size_bytes?: number | null
          source?: string | null
          storage_bucket?: string
          storage_path?: string
          updated_at?: string | null
          uploaded_by_user_id?: string | null
          version?: number | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_cadences: {
        Row: {
          business_days_only: boolean | null
          cadence_key: string
          created_at: string | null
          days_until_event_max: number | null
          days_until_event_min: number | null
          description: string | null
          follow_up_days: number
          id: string
          is_active: boolean | null
          name: string
          pauses_follow_up: boolean | null
          priority: number | null
          status: string
          updated_at: string | null
          work_item_type: string
        }
        Insert: {
          business_days_only?: boolean | null
          cadence_key: string
          created_at?: string | null
          days_until_event_max?: number | null
          days_until_event_min?: number | null
          description?: string | null
          follow_up_days: number
          id?: string
          is_active?: boolean | null
          name: string
          pauses_follow_up?: boolean | null
          priority?: number | null
          status: string
          updated_at?: string | null
          work_item_type: string
        }
        Update: {
          business_days_only?: boolean | null
          cadence_key?: string
          created_at?: string | null
          days_until_event_max?: number | null
          days_until_event_min?: number | null
          description?: string | null
          follow_up_days?: number
          id?: string
          is_active?: boolean | null
          name?: string
          pauses_follow_up?: boolean | null
          priority?: number | null
          status?: string
          updated_at?: string | null
          work_item_type?: string
        }
        Relationships: []
      }
      integration_accounts: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          provider: string
          scopes: string[] | null
          settings: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          provider: string
          scopes?: string[] | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          provider?: string
          scopes?: string[] | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          message: string | null
          link: string | null
          communication_id: string | null
          is_read: boolean
          email_sent: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type?: string
          title: string
          message?: string | null
          link?: string | null
          communication_id?: string | null
          is_read?: boolean
          email_sent?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          message?: string | null
          link?: string | null
          communication_id?: string | null
          is_read?: boolean
          email_sent?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_communication_id_fkey"
            columns: ["communication_id"]
            isOneToOne: false
            referencedRelation: "communications"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_docs: {
        Row: {
          id: string
          name: string
          category: string
          original_filename: string
          storage_path: string
          mime_type: string | null
          size_bytes: number | null
          content_text: string | null
          is_active: boolean
          uploaded_by_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string
          original_filename: string
          storage_path: string
          mime_type?: string | null
          size_bytes?: number | null
          content_text?: string | null
          is_active?: boolean
          uploaded_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          original_filename?: string
          storage_path?: string
          mime_type?: string | null
          size_bytes?: number | null
          content_text?: string | null
          is_active?: boolean
          uploaded_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      quick_reply_templates: {
        Row: {
          attachment_urls: string[] | null
          body_html_template: string
          body_plain_template: string | null
          category: string | null
          created_at: string | null
          description: string | null
          has_attachments: boolean | null
          id: string
          is_active: boolean | null
          key: string
          keyboard_shortcut: string | null
          last_used_at: string | null
          merge_fields: string[] | null
          name: string
          requires_customization: boolean | null
          subject_template: string | null
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          attachment_urls?: string[] | null
          body_html_template: string
          body_plain_template?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          has_attachments?: boolean | null
          id?: string
          is_active?: boolean | null
          key: string
          keyboard_shortcut?: string | null
          last_used_at?: string | null
          merge_fields?: string[] | null
          name: string
          requires_customization?: boolean | null
          subject_template?: string | null
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          attachment_urls?: string[] | null
          body_html_template?: string
          body_plain_template?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          has_attachments?: boolean | null
          id?: string
          is_active?: boolean | null
          key?: string
          keyboard_shortcut?: string | null
          last_used_at?: string | null
          merge_fields?: string[] | null
          name?: string
          requires_customization?: boolean | null
          subject_template?: string | null
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      reminder_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          reminder_template_id: string
          retry_count: number | null
          scheduled_for: string
          sent_at: string | null
          status: string | null
          updated_at: string | null
          work_item_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          reminder_template_id: string
          retry_count?: number | null
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          work_item_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          reminder_template_id?: string
          retry_count?: number | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_queue_reminder_template_id_fkey"
            columns: ["reminder_template_id"]
            isOneToOne: false
            referencedRelation: "reminder_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_templates: {
        Row: {
          body_html_template: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          key: string
          last_sent_at: string | null
          merge_fields: string[] | null
          name: string
          operator_email: string | null
          send_to_customer: boolean | null
          send_to_operator: boolean | null
          sent_count: number | null
          subject_template: string
          trigger_days: number
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          body_html_template: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          last_sent_at?: string | null
          merge_fields?: string[] | null
          name: string
          operator_email?: string | null
          send_to_customer?: boolean | null
          send_to_operator?: boolean | null
          sent_count?: number | null
          subject_template: string
          trigger_days: number
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          body_html_template?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          last_sent_at?: string | null
          merge_fields?: string[] | null
          name?: string
          operator_email?: string | null
          send_to_customer?: boolean | null
          send_to_operator?: boolean | null
          sent_count?: number | null
          subject_template?: string
          trigger_days?: number
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      retail_accounts: {
        Row: {
          account_name: string
          account_type: string | null
          assigned_at: string | null
          assigned_to_user_id: string | null
          billing_email: string | null
          business_address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          created_by_user_id: string | null
          credit_limit: number | null
          first_order_date: string | null
          id: string
          industry: string | null
          internal_notes: string | null
          last_order_date: string | null
          payment_terms: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          shopify_customer_id: string | null
          state: string | null
          status: string | null
          tags: string[] | null
          tax_id: string | null
          total_orders: number | null
          total_revenue: number | null
          updated_at: string | null
          website_url: string | null
          zip_code: string | null
        }
        Insert: {
          account_name: string
          account_type?: string | null
          assigned_at?: string | null
          assigned_to_user_id?: string | null
          billing_email?: string | null
          business_address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          credit_limit?: number | null
          first_order_date?: string | null
          id?: string
          industry?: string | null
          internal_notes?: string | null
          last_order_date?: string | null
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          shopify_customer_id?: string | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          tax_id?: string | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          website_url?: string | null
          zip_code?: string | null
        }
        Update: {
          account_name?: string
          account_type?: string | null
          assigned_at?: string | null
          assigned_to_user_id?: string | null
          billing_email?: string | null
          business_address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          credit_limit?: number | null
          first_order_date?: string | null
          id?: string
          industry?: string | null
          internal_notes?: string | null
          last_order_date?: string | null
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          shopify_customer_id?: string | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          tax_id?: string | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          website_url?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retail_accounts_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retail_accounts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          id: string
          key: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      shopify_credentials: {
        Row: {
          access_token: string
          created_at: string
          id: string
          scope: string
          shop: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          scope: string
          shop: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          scope?: string
          shop?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopify_orders: {
        Row: {
          created_at: string
          currency: string | null
          customer_email: string
          customer_id: string | null
          financial_status: string | null
          fulfillment_status: string | null
          id: string
          line_items: Json | null
          order_data: Json | null
          shopify_order_id: string
          shopify_order_number: string
          subtotal_price: number | null
          total_price: number
          total_tax: number | null
          updated_at: string | null
        }
        Insert: {
          created_at: string
          currency?: string | null
          customer_email: string
          customer_id?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          line_items?: Json | null
          order_data?: Json | null
          shopify_order_id: string
          shopify_order_number: string
          subtotal_price?: number | null
          total_price: number
          total_tax?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          customer_email?: string
          customer_id?: string | null
          financial_status?: string | null
          fulfillment_status?: string | null
          id?: string
          line_items?: Json | null
          order_data?: Json | null
          shopify_order_id?: string
          shopify_order_number?: string
          subtotal_price?: number | null
          total_price?: number
          total_tax?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_sync_queue: {
        Row: {
          completed_at: string | null
          created_at: string | null
          customer_id: string | null
          error_code: string | null
          error_message: string | null
          id: string
          last_retry_at: string | null
          max_retries: number | null
          next_retry_at: string | null
          retry_count: number | null
          shopify_resource_id: string
          shopify_resource_type: string
          shopify_response: Json | null
          status: string | null
          sync_payload: Json
          sync_type: string
          updated_at: string | null
          work_item_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          retry_count?: number | null
          shopify_resource_id: string
          shopify_resource_type: string
          shopify_response?: Json | null
          status?: string | null
          sync_payload: Json
          sync_type: string
          updated_at?: string | null
          work_item_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          retry_count?: number | null
          shopify_resource_id?: string
          shopify_resource_type?: string
          shopify_response?: Json | null
          status?: string | null
          sync_payload?: Json
          sync_type?: string
          updated_at?: string | null
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_sync_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopify_sync_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_tag_mappings: {
        Row: {
          created_at: string | null
          id: string
          internal_tag_id: string | null
          is_active: boolean | null
          match_type: string | null
          shopify_tag_pattern: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          internal_tag_id?: string | null
          is_active?: boolean | null
          match_type?: string | null
          shopify_tag_pattern: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          internal_tag_id?: string | null
          is_active?: boolean | null
          match_type?: string | null
          shopify_tag_pattern?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_tag_mappings_internal_tag_id_fkey"
            columns: ["internal_tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          body_html_template: string
          created_at: string | null
          id: string
          is_active: boolean | null
          key: string
          merge_fields: string[] | null
          name: string
          subject_template: string
          updated_at: string | null
        }
        Insert: {
          body_html_template: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          merge_fields?: string[] | null
          name: string
          subject_template: string
          updated_at?: string | null
        }
        Update: {
          body_html_template?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          merge_fields?: string[] | null
          name?: string
          subject_template?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          email_signature_html: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          role_id: string | null
          signature_logo_url: string | null
          signature_name: string | null
          signature_title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          email_signature_html?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          role_id?: string | null
          signature_logo_url?: string | null
          signature_name?: string | null
          signature_title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          email_signature_html?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string | null
          signature_logo_url?: string | null
          signature_name?: string | null
          signature_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          external_event_id: string | null
          id: string
          payload: Json
          processed_at: string | null
          processing_status: string | null
          provider: string
          received_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          external_event_id?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          processing_status?: string | null
          provider: string
          received_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          external_event_id?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_status?: string | null
          provider?: string
          received_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      work_item_notes: {
        Row: {
          author_email: string
          content: string
          created_at: string | null
          created_by_user_id: string | null
          external_id: string | null
          id: string
          is_internal: boolean | null
          source: string | null
          starred: boolean | null
          synced_at: string | null
          updated_at: string | null
          work_item_id: string
        }
        Insert: {
          author_email: string
          content: string
          created_at?: string | null
          created_by_user_id?: string | null
          external_id?: string | null
          id?: string
          is_internal?: boolean | null
          source?: string | null
          starred?: boolean | null
          synced_at?: string | null
          updated_at?: string | null
          work_item_id: string
        }
        Update: {
          author_email?: string
          content?: string
          created_at?: string | null
          created_by_user_id?: string | null
          external_id?: string | null
          id?: string
          is_internal?: boolean | null
          source?: string | null
          starred?: boolean | null
          synced_at?: string | null
          updated_at?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_notes_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_notes_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_status_events: {
        Row: {
          changed_by_user_id: string | null
          created_at: string | null
          from_status: string | null
          id: string
          note: string | null
          to_status: string
          updated_at: string | null
          work_item_id: string
        }
        Insert: {
          changed_by_user_id?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
          updated_at?: string | null
          work_item_id: string
        }
        Update: {
          changed_by_user_id?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
          updated_at?: string | null
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_status_events_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_status_events_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_item_tags: {
        Row: {
          created_at: string | null
          tag_id: string
          work_item_id: string
        }
        Insert: {
          created_at?: string | null
          tag_id: string
          work_item_id: string
        }
        Update: {
          created_at?: string | null
          tag_id?: string
          work_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_item_tags_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      work_items: {
        Row: {
          actual_value: number | null
          alternate_emails: string[] | null
          assigned_at: string | null
          assigned_by_email: string | null
          assigned_to_email: string | null
          assigned_to_user_id: string | null
          batch_id: string | null
          batched_at: string | null
          close_reason: string | null
          closed_at: string | null
          created_at: string | null
          created_by_user_id: string | null
          customer_email: string | null
          customer_feedback: string | null
          customer_id: string | null
          customer_name: string | null
          design_download_url: string | null
          design_fee_order_id: string | null
          design_fee_order_number: string | null
          design_preview_url: string | null
          design_review_status: string | null
          due_date: string | null
          estimated_value: number | null
          event_date: string | null
          follow_up_cadence_key: string | null
          grip_color: string | null
          id: string
          is_waiting: boolean | null
          last_activity_at: string | null
          last_contact_at: string | null
          missed_design_window: boolean | null
          next_follow_up_at: string | null
          payment_history: Json | null
          priority: string | null
          proof_approved_at: string | null
          proof_sent_at: string | null
          quantity: number | null
          ready_for_batch_at: string | null
          reason_included: Json | null
          requires_initial_contact: boolean | null
          retail_account_id: string | null
          revision_count: number | null
          rush_order: boolean | null
          ship_by_date: string | null
          shopify_draft_order_id: string | null
          shopify_financial_status: string | null
          shopify_fulfillment_status: string | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          source: string
          status: string
          suppress_drip_emails: boolean
          title: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          actual_value?: number | null
          alternate_emails?: string[] | null
          assigned_at?: string | null
          assigned_by_email?: string | null
          assigned_to_email?: string | null
          assigned_to_user_id?: string | null
          batch_id?: string | null
          batched_at?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          customer_email?: string | null
          customer_feedback?: string | null
          customer_id?: string | null
          customer_name?: string | null
          design_download_url?: string | null
          design_fee_order_id?: string | null
          design_fee_order_number?: string | null
          design_preview_url?: string | null
          design_review_status?: string | null
          due_date?: string | null
          estimated_value?: number | null
          event_date?: string | null
          follow_up_cadence_key?: string | null
          grip_color?: string | null
          id?: string
          is_waiting?: boolean | null
          last_activity_at?: string | null
          last_contact_at?: string | null
          missed_design_window?: boolean | null
          next_follow_up_at?: string | null
          payment_history?: Json | null
          priority?: string | null
          proof_approved_at?: string | null
          proof_sent_at?: string | null
          quantity?: number | null
          ready_for_batch_at?: string | null
          reason_included?: Json | null
          requires_initial_contact?: boolean | null
          retail_account_id?: string | null
          revision_count?: number | null
          rush_order?: boolean | null
          ship_by_date?: string | null
          shopify_draft_order_id?: string | null
          shopify_financial_status?: string | null
          shopify_fulfillment_status?: string | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          source: string
          status: string
          suppress_drip_emails?: boolean
          title?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          actual_value?: number | null
          alternate_emails?: string[] | null
          assigned_at?: string | null
          assigned_by_email?: string | null
          assigned_to_email?: string | null
          assigned_to_user_id?: string | null
          batch_id?: string | null
          batched_at?: string | null
          close_reason?: string | null
          closed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          customer_email?: string | null
          customer_feedback?: string | null
          customer_id?: string | null
          customer_name?: string | null
          design_download_url?: string | null
          design_fee_order_id?: string | null
          design_fee_order_number?: string | null
          design_preview_url?: string | null
          design_review_status?: string | null
          due_date?: string | null
          estimated_value?: number | null
          event_date?: string | null
          follow_up_cadence_key?: string | null
          grip_color?: string | null
          id?: string
          is_waiting?: boolean | null
          last_activity_at?: string | null
          last_contact_at?: string | null
          missed_design_window?: boolean | null
          next_follow_up_at?: string | null
          payment_history?: Json | null
          priority?: string | null
          proof_approved_at?: string | null
          proof_sent_at?: string | null
          quantity?: number | null
          ready_for_batch_at?: string | null
          reason_included?: Json | null
          requires_initial_contact?: boolean | null
          retail_account_id?: string | null
          revision_count?: number | null
          rush_order?: boolean | null
          ship_by_date?: string | null
          shopify_draft_order_id?: string | null
          shopify_financial_status?: string | null
          shopify_fulfillment_status?: string | null
          shopify_order_id?: string | null
          shopify_order_number?: string | null
          source?: string
          status?: string
          suppress_drip_emails?: boolean
          title?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_work_items_batch"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_retail_account_id_fkey"
            columns: ["retail_account_id"]
            isOneToOne: false
            referencedRelation: "retail_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      customer_conversations: {
        Row: {
          conversation_id: string | null
          conversation_status: string | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          has_unread: boolean | null
          last_message_at: string | null
          last_message_direction: string | null
          last_message_from: string | null
          message_count: number | null
          subject: string | null
          work_item_id: string | null
          work_item_status: string | null
          work_item_title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dlq_failure_patterns: {
        Row: {
          error_code: string | null
          error_message_preview: string | null
          failed_count: number | null
          first_occurrence: string | null
          last_occurrence: string | null
          occurrence_count: number | null
          operation_type: string | null
          resolved_count: number | null
        }
        Relationships: []
      }
      dlq_health: {
        Row: {
          failed_count: number | null
          ignored_count: number | null
          items_last_24h: number | null
          items_last_hour: number | null
          needs_alert_count: number | null
          pending_count: number | null
          resolved_count: number | null
          retrying_count: number | null
          total_items: number | null
        }
        Relationships: []
      }
      email_filter_stats: {
        Row: {
          filter_type: string | null
          id: string | null
          is_active: boolean | null
          last_matched_at: string | null
          match_count: number | null
          name: string | null
          pattern: string | null
          priority: number | null
          target_category: string | null
        }
        Insert: {
          filter_type?: string | null
          id?: string | null
          is_active?: boolean | null
          last_matched_at?: string | null
          match_count?: number | null
          name?: string | null
          pattern?: string | null
          priority?: number | null
          target_category?: string | null
        }
        Update: {
          filter_type?: string | null
          id?: string | null
          is_active?: boolean | null
          last_matched_at?: string | null
          match_count?: number | null
          name?: string | null
          pattern?: string | null
          priority?: number | null
          target_category?: string | null
        }
        Relationships: []
      }
      email_import_health: {
        Row: {
          emails_last_24h: number | null
          emails_last_hour: number | null
          missing_message_ids: number | null
          potential_duplicates: number | null
          total_emails: number | null
          unique_message_ids: number | null
        }
        Relationships: []
      }
      potential_duplicate_emails: {
        Row: {
          email_1_created_at: string | null
          email_1_id: string | null
          email_1_received_at: string | null
          email_2_created_at: string | null
          email_2_id: string | null
          email_2_received_at: string | null
          from_email: string | null
          match_type: string | null
          subject: string | null
        }
        Relationships: []
      }
      production_pipeline: {
        Row: {
          actual_value: number | null
          alternate_emails: string[] | null
          assigned_at: string | null
          assigned_by_email: string | null
          assigned_to_email: string | null
          assigned_to_user_id: string | null
          batch_id: string | null
          batched_at: string | null
          close_reason: string | null
          closed_at: string | null
          created_at: string | null
          customer_email: string | null
          customer_feedback: string | null
          customer_id: string | null
          customer_name: string | null
          days_until_event: number | null
          design_download_url: string | null
          design_fee_order_id: string | null
          design_fee_order_number: string | null
          design_preview_url: string | null
          design_review_status: string | null
          due_date: string | null
          estimated_value: number | null
          event_date: string | null
          file_count: number | null
          follow_up_cadence_key: string | null
          grip_color: string | null
          id: string | null
          is_waiting: boolean | null
          last_activity_at: string | null
          last_contact_at: string | null
          missed_design_window: boolean | null
          next_follow_up_at: string | null
          payment_history: Json | null
          priority: string | null
          proof_approved_at: string | null
          proof_sent_at: string | null
          quantity: number | null
          ready_for_batch_at: string | null
          reason_included: Json | null
          requires_initial_contact: boolean | null
          retail_account_id: string | null
          revision_count: number | null
          rush_order: boolean | null
          ship_by_date: string | null
          shopify_draft_order_id: string | null
          shopify_financial_status: string | null
          shopify_fulfillment_status: string | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          source: string | null
          status: string | null
          suppress_drip_emails: boolean | null
          tag_colors: string[] | null
          tag_names: string[] | null
          title: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_work_items_batch"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_retail_account_id_fkey"
            columns: ["retail_account_id"]
            isOneToOne: false
            referencedRelation: "retail_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_stats: {
        Row: {
          failed_count: number | null
          is_active: boolean | null
          last_sent_at: string | null
          pending_count: number | null
          sent_count: number | null
          template_key: string | null
          template_name: string | null
          trigger_type: string | null
        }
        Relationships: []
      }
      sales_pipeline: {
        Row: {
          actual_value: number | null
          alternate_emails: string[] | null
          assigned_at: string | null
          assigned_by_email: string | null
          assigned_to_email: string | null
          assigned_to_user_id: string | null
          batch_id: string | null
          batched_at: string | null
          close_reason: string | null
          closed_at: string | null
          created_at: string | null
          customer_email: string | null
          customer_feedback: string | null
          customer_id: string | null
          customer_name: string | null
          design_download_url: string | null
          design_fee_order_id: string | null
          design_fee_order_number: string | null
          design_preview_url: string | null
          design_review_status: string | null
          due_date: string | null
          email_count: number | null
          estimated_value: number | null
          event_date: string | null
          follow_up_cadence_key: string | null
          grip_color: string | null
          id: string | null
          is_due_today: boolean | null
          is_overdue: boolean | null
          is_waiting: boolean | null
          last_activity_at: string | null
          last_contact_at: string | null
          latest_email_preview: string | null
          missed_design_window: boolean | null
          next_follow_up_at: string | null
          payment_history: Json | null
          priority: string | null
          proof_approved_at: string | null
          proof_sent_at: string | null
          quantity: number | null
          ready_for_batch_at: string | null
          reason_included: Json | null
          requires_initial_contact: boolean | null
          retail_account_id: string | null
          revision_count: number | null
          rush_order: boolean | null
          ship_by_date: string | null
          shopify_draft_order_id: string | null
          shopify_financial_status: string | null
          shopify_fulfillment_status: string | null
          shopify_order_id: string | null
          shopify_order_number: string | null
          source: string | null
          status: string | null
          suppress_drip_emails: boolean | null
          tag_colors: string[] | null
          tag_names: string[] | null
          title: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_work_items_batch"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_assigned_to_user_id_fkey"
            columns: ["assigned_to_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_items_retail_account_id_fkey"
            columns: ["retail_account_id"]
            isOneToOne: false
            referencedRelation: "retail_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stuck_awaiting_files: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          days_waiting: number | null
          id: string | null
          last_contact_at: string | null
          next_follow_up_at: string | null
          priority_score: number | null
          status: string | null
          stuck_reason: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_waiting?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_waiting?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      stuck_design_review: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          days_pending: number | null
          design_review_status: string | null
          id: string | null
          next_follow_up_at: string | null
          priority_score: number | null
          status: string | null
          stuck_reason: string | null
          title: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_pending?: never
          design_review_status?: string | null
          id?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_pending?: never
          design_review_status?: string | null
          id?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stuck_dlq_failures: {
        Row: {
          created_at: string | null
          days_failed: number | null
          error_message: string | null
          id: string | null
          last_retry_at: string | null
          operation_key: string | null
          operation_type: string | null
          priority_score: number | null
          retry_count: number | null
          stuck_reason: string | null
          work_item_id: string | null
        }
        Insert: {
          created_at?: string | null
          days_failed?: never
          error_message?: string | null
          id?: string | null
          last_retry_at?: string | null
          operation_key?: string | null
          operation_type?: string | null
          priority_score?: never
          retry_count?: number | null
          stuck_reason?: never
          work_item_id?: string | null
        }
        Update: {
          created_at?: string | null
          days_failed?: never
          error_message?: string | null
          id?: string | null
          last_retry_at?: string | null
          operation_key?: string | null
          operation_type?: string | null
          priority_score?: never
          retry_count?: number | null
          stuck_reason?: never
          work_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "production_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "sales_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_awaiting_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_design_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_expired_approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_no_follow_up"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_overdue_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "stuck_stale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dead_letter_queue_work_item_id_fkey"
            columns: ["work_item_id"]
            isOneToOne: false
            referencedRelation: "work_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stuck_expired_approvals: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          days_waiting: number | null
          id: string | null
          last_contact_at: string | null
          next_follow_up_at: string | null
          priority_score: number | null
          status: string | null
          stuck_reason: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_waiting?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_waiting?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      stuck_items_dashboard: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          days_stuck: number | null
          dlq_id: string | null
          item_type: string | null
          last_contact_at: string | null
          next_follow_up_at: string | null
          priority_score: number | null
          status: string | null
          stuck_reason: string | null
          title: string | null
          work_item_id: string | null
        }
        Relationships: []
      }
      stuck_items_summary: {
        Row: {
          awaiting_files_count: number | null
          design_review_count: number | null
          dlq_failures_count: number | null
          expired_approvals_count: number | null
          no_follow_up_count: number | null
          overdue_invoices_count: number | null
          stale_items_count: number | null
          total_stuck_items: number | null
        }
        Relationships: []
      }
      stuck_no_follow_up: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          days_since_update: number | null
          id: string | null
          last_contact_at: string | null
          next_follow_up_at: string | null
          priority_score: number | null
          status: string | null
          stuck_reason: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_since_update?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_since_update?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      stuck_overdue_invoices: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          days_since_deposit: number | null
          id: string | null
          last_contact_at: string | null
          next_follow_up_at: string | null
          priority_score: number | null
          shopify_financial_status: string | null
          status: string | null
          stuck_reason: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_since_deposit?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          shopify_financial_status?: string | null
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_since_deposit?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          shopify_financial_status?: string | null
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
        }
        Relationships: []
      }
      stuck_stale_items: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          days_stale: number | null
          id: string | null
          last_contact_at: string | null
          next_follow_up_at: string | null
          priority_score: number | null
          status: string | null
          stuck_reason: string | null
          title: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_stale?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          days_stale?: never
          id?: string | null
          last_contact_at?: string | null
          next_follow_up_at?: string | null
          priority_score?: never
          status?: string | null
          stuck_reason?: never
          title?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      template_usage_stats: {
        Row: {
          category: string | null
          is_active: boolean | null
          key: string | null
          keyboard_shortcut: string | null
          last_used_at: string | null
          name: string | null
          use_count: number | null
        }
        Insert: {
          category?: string | null
          is_active?: boolean | null
          key?: string | null
          keyboard_shortcut?: string | null
          last_used_at?: string | null
          name?: string | null
          use_count?: number | null
        }
        Update: {
          category?: string | null
          is_active?: boolean | null
          key?: string | null
          keyboard_shortcut?: string | null
          last_used_at?: string | null
          name?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      unread_conversations: {
        Row: {
          conversation_id: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          hours_since_last_message: number | null
          last_message_at: string | null
          message_count: number | null
          subject: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_business_days: {
        Args: { base_date: string; days: number }
        Returns: string
      }
      add_to_dlq: {
        Args: {
          p_communication_id?: string
          p_customer_id?: string
          p_error_code?: string
          p_error_message: string
          p_error_stack?: string
          p_max_retries?: number
          p_operation_key: string
          p_operation_payload: Json
          p_operation_type: string
          p_work_item_id?: string
        }
        Returns: string
      }
      apply_email_filters:
        | {
            Args: { p_from_email: string }
            Returns: {
              filter_id: string
              matched_category: string
            }[]
          }
        | {
            Args: { p_from_email: string; p_subject?: string }
            Returns: {
              filter_id: string
              matched_category: string
            }[]
          }
      auto_archive_junk_conversations: { Args: never; Returns: number }
      calculate_next_follow_up: {
        Args: { work_item_id: string }
        Returns: string
      }
      change_work_item_status: {
        Args: {
          p_changed_by_user_id?: string
          p_new_status: string
          p_note?: string
          p_work_item_id: string
        }
        Returns: {
          new_status: string
          old_status: string
        }[]
      }
      create_batch_with_items: {
        Args: {
          p_created_by_user_id: string
          p_name: string
          p_work_item_ids: string[]
        }
        Returns: string
      }
      find_or_create_conversation: {
        Args: {
          p_customer_id?: string
          p_provider: string
          p_provider_thread_id: string
          p_subject: string
          p_work_item_id?: string
        }
        Returns: string
      }
      generate_reminders: {
        Args: never
        Returns: {
          scheduled_for: string
          template_key: string
          work_item_id: string
        }[]
      }
      get_pending_reminders: {
        Args: { p_limit?: number }
        Returns: {
          body_html: string
          customer_email: string
          customer_name: string
          operator_email: string
          reminder_id: string
          send_to_customer: boolean
          send_to_operator: boolean
          subject: string
          template_key: string
          work_item_id: string
          work_item_title: string
        }[]
      }
      get_retryable_dlq_items: {
        Args: { p_limit?: number }
        Returns: {
          alert_channel: string | null
          alerted_at: string | null
          communication_id: string | null
          created_at: string | null
          customer_id: string | null
          error_code: string | null
          error_message: string
          error_stack: string | null
          id: string
          last_retry_at: string | null
          max_retries: number | null
          next_retry_at: string | null
          operation_key: string
          operation_metadata: Json | null
          operation_payload: Json
          operation_type: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by_user_id: string | null
          retry_count: number | null
          status: string | null
          updated_at: string | null
          work_item_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "dead_letter_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_role: { Args: never; Returns: string }
      recalculate_all_follow_ups: {
        Args: never
        Returns: {
          cadence_key: string
          new_follow_up: string
          old_follow_up: string
          work_item_id: string
        }[]
      }
      resolve_dlq_item: {
        Args: {
          p_dlq_id: string
          p_resolution_note?: string
          p_resolved_by_user_id?: string
        }
        Returns: boolean
      }
      track_template_usage: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      update_conversation_stats: {
        Args: {
          p_conversation_id: string
          p_message_direction: string
          p_message_from: string
          p_received_at: string
        }
        Returns: undefined
      }
      update_customer_aggregates: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      sales_stage_enum:
        | "new_lead"
        | "contacted"
        | "in_discussion"
        | "quoted"
        | "negotiating"
        | "won"
        | "active_customer"
        | "lost"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      sales_stage_enum: [
        "new_lead",
        "contacted",
        "in_discussion",
        "quoted",
        "negotiating",
        "won",
        "active_customer",
        "lost",
      ],
    },
  },
} as const

// ─── Custom Application-Level Type Aliases ──────────────────────────
// These narrow DB string columns to known application values.
// Keep in sync with status-transitions.ts and the actual DB values.

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

export type CustomifyOrderStatus =
  | 'needs_design_review'
  | 'needs_customer_fix'
  | 'approved'
  | 'ready_for_batch'
  | 'batched'
  | 'shipped'
  | 'closed'

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
