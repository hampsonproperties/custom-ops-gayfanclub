import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type OperationType =
  | 'email_import'
  | 'file_download'
  | 'file_upload'
  | 'webhook_processing'
  | 'email_send'
  | 'follow_up_calculation'
  | 'batch_export'
  | 'shopify_api_call'
  | 'graph_api_call'
  | 'other'

export type DLQStatus = 'pending' | 'retrying' | 'resolved' | 'failed' | 'ignored'

export interface DLQItem {
  id: string
  operation_type: OperationType
  operation_key: string
  work_item_id?: string
  customer_id?: string
  communication_id?: string
  error_message: string
  error_code?: string
  error_stack?: string
  operation_payload: Record<string, any>
  operation_metadata?: Record<string, any>
  retry_count: number
  max_retries: number
  next_retry_at?: string
  last_retry_at?: string
  status: DLQStatus
  resolved_at?: string
  resolved_by_user_id?: string
  resolution_note?: string
  alerted_at?: string
  alert_channel?: string
  created_at: string
  updated_at: string
}

export interface AddToDLQOptions {
  operationType: OperationType
  operationKey: string
  errorMessage: string
  operationPayload: Record<string, any>
  errorCode?: string
  errorStack?: string
  workItemId?: string
  customerId?: string
  communicationId?: string
  maxRetries?: number
}

/**
 * Add a failed operation to the Dead Letter Queue
 *
 * This function should be called in catch blocks to ensure no errors are silently swallowed.
 * The DLQ will automatically retry the operation with exponential backoff.
 *
 * @example
 * ```typescript
 * try {
 *   await downloadFile(url, path)
 * } catch (error) {
 *   await addToDLQ({
 *     operationType: 'file_download',
 *     operationKey: `file:${orderId}:${filename}`,
 *     errorMessage: error.message,
 *     errorStack: error.stack,
 *     operationPayload: { url, path, orderId },
 *     workItemId: workItemId,
 *   })
 *   // Don't throw - let operation continue
 * }
 * ```
 */
export async function addToDLQ(options: AddToDLQOptions): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { data, error } = await supabase.rpc('add_to_dlq', {
      p_operation_type: options.operationType,
      p_operation_key: options.operationKey,
      p_error_message: options.errorMessage,
      p_operation_payload: options.operationPayload,
      p_error_code: options.errorCode || null,
      p_error_stack: options.errorStack || null,
      p_work_item_id: options.workItemId || null,
      p_customer_id: options.customerId || null,
      p_communication_id: options.communicationId || null,
      p_max_retries: options.maxRetries || 5,
    })

    if (error) {
      console.error('[DLQ] Failed to add to Dead Letter Queue:', error)
      return null
    }

    console.log('[DLQ] Added to Dead Letter Queue:', {
      dlqId: data,
      operationType: options.operationType,
      operationKey: options.operationKey,
    })

    return data as string
  } catch (error) {
    console.error('[DLQ] Unexpected error adding to DLQ:', error)
    return null
  }
}

/**
 * Get items ready for retry
 */
export async function getRetryableItems(limit = 10): Promise<DLQItem[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase.rpc('get_retryable_dlq_items', {
    p_limit: limit,
  })

  if (error) {
    console.error('[DLQ] Error fetching retryable items:', error)
    throw error
  }

  return (data as DLQItem[]) || []
}

/**
 * Mark a DLQ item as successfully resolved
 */
export async function resolveDLQItem(
  dlqId: string,
  resolutionNote?: string,
  resolvedByUserId?: string
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase.rpc('resolve_dlq_item', {
    p_dlq_id: dlqId,
    p_resolution_note: resolutionNote || null,
    p_resolved_by_user_id: resolvedByUserId || null,
  })

  if (error) {
    console.error('[DLQ] Error resolving item:', error)
    throw error
  }

  return data as boolean
}

/**
 * Mark a DLQ item as ignored (non-critical failure)
 */
export async function ignoreDLQItem(
  dlqId: string,
  reason: string,
  userId?: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase
    .from('dead_letter_queue')
    .update({
      status: 'ignored',
      resolution_note: reason,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: userId || null,
    })
    .eq('id', dlqId)

  if (error) {
    console.error('[DLQ] Error ignoring item:', error)
    throw error
  }
}

/**
 * Get DLQ health statistics
 */
export async function getDLQHealth(): Promise<{
  total_items: number
  pending_count: number
  retrying_count: number
  failed_count: number
  resolved_count: number
  ignored_count: number
  needs_alert_count: number
  items_last_24h: number
  items_last_hour: number
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase.from('dlq_health').select('*').single()

  if (error) {
    console.error('[DLQ] Error fetching health stats:', error)
    throw error
  }

  return data
}

/**
 * Get common failure patterns for debugging
 */
export async function getFailurePatterns(limit = 20): Promise<
  Array<{
    operation_type: string
    error_code?: string
    error_message_preview: string
    occurrence_count: number
    failed_count: number
    resolved_count: number
    last_occurrence: string
    first_occurrence: string
  }>
> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('dlq_failure_patterns')
    .select('*')
    .limit(limit)

  if (error) {
    console.error('[DLQ] Error fetching failure patterns:', error)
    throw error
  }

  return data || []
}

/**
 * Wrapper to execute an operation with automatic DLQ handling
 *
 * @example
 * ```typescript
 * await withDLQ({
 *   operationType: 'file_download',
 *   operationKey: `file:${orderId}:${filename}`,
 *   workItemId,
 *   operation: async () => {
 *     return await downloadFile(url, path)
 *   }
 * })
 * ```
 */
export async function withDLQ<T>(options: {
  operationType: OperationType
  operationKey: string
  operation: () => Promise<T>
  workItemId?: string
  customerId?: string
  communicationId?: string
  maxRetries?: number
  throwOnError?: boolean
}): Promise<T | null> {
  try {
    return await options.operation()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    await addToDLQ({
      operationType: options.operationType,
      operationKey: options.operationKey,
      errorMessage,
      errorStack,
      operationPayload: {
        timestamp: new Date().toISOString(),
      },
      workItemId: options.workItemId,
      customerId: options.customerId,
      communicationId: options.communicationId,
      maxRetries: options.maxRetries,
    })

    if (options.throwOnError) {
      throw error
    }

    return null
  }
}
