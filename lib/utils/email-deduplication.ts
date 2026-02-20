import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export interface GraphMessage {
  id: string
  internetMessageId?: string | null
  subject: string | null
  from?: {
    emailAddress: {
      address: string
      name?: string
    }
  }
  receivedDateTime: string
  conversationId?: string | null
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  strategy?: 'provider_message_id' | 'internet_message_id' | 'fingerprint'
  existingCommunicationId?: string
  matchedOn?: {
    provider_message_id?: string
    internet_message_id?: string
    fingerprint?: {
      from_email: string
      subject: string
      received_at: string
    }
  }
}

/**
 * Check if an email is a duplicate using 3-strategy approach:
 * 1. provider_message_id (Microsoft Graph message ID)
 * 2. internet_message_id (RFC 2822 Message-ID header)
 * 3. Fingerprint (from_email + subject + received_at within 5 seconds)
 *
 * This function is called BEFORE attempting to insert the email to prevent
 * race conditions and provide detailed duplicate detection information.
 */
export async function isDuplicateEmail(
  message: GraphMessage
): Promise<DuplicateCheckResult> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // STRATEGY 1: Check provider_message_id (Microsoft Graph message ID)
  if (message.id) {
    const { data: existingByProvider, error: providerError } = await supabase
      .from('communications')
      .select('id')
      .eq('provider_message_id', message.id)
      .maybeSingle()

    if (providerError) {
      console.error('[Deduplication] Error checking provider_message_id:', providerError)
      // Continue to next strategy instead of failing
    } else if (existingByProvider) {
      console.log('[Deduplication] Duplicate found via provider_message_id:', {
        provider_message_id: message.id,
        existing_communication_id: existingByProvider.id,
      })
      return {
        isDuplicate: true,
        strategy: 'provider_message_id',
        existingCommunicationId: existingByProvider.id,
        matchedOn: {
          provider_message_id: message.id,
        },
      }
    }
  }

  // STRATEGY 2: Check internet_message_id (RFC 2822 Message-ID)
  if (message.internetMessageId) {
    const { data: existingByInternet, error: internetError } = await supabase
      .from('communications')
      .select('id')
      .eq('internet_message_id', message.internetMessageId)
      .maybeSingle()

    if (internetError) {
      console.error('[Deduplication] Error checking internet_message_id:', internetError)
      // Continue to next strategy
    } else if (existingByInternet) {
      console.log('[Deduplication] Duplicate found via internet_message_id:', {
        internet_message_id: message.internetMessageId,
        existing_communication_id: existingByInternet.id,
      })
      return {
        isDuplicate: true,
        strategy: 'internet_message_id',
        existingCommunicationId: existingByInternet.id,
        matchedOn: {
          internet_message_id: message.internetMessageId,
        },
      }
    }
  }

  // STRATEGY 3: Fingerprint matching (from_email + subject + received_at within 5 seconds)
  const fromEmail = message.from?.emailAddress?.address
  const subject = message.subject
  const receivedAt = new Date(message.receivedDateTime)

  if (fromEmail && subject !== null && receivedAt) {
    // Calculate time window (±5 seconds)
    const timeWindowStart = new Date(receivedAt.getTime() - 5000).toISOString()
    const timeWindowEnd = new Date(receivedAt.getTime() + 5000).toISOString()

    const { data: existingByFingerprint, error: fingerprintError } = await supabase
      .from('communications')
      .select('id, received_at')
      .eq('from_email', fromEmail)
      .eq('subject', subject || '') // Handle null subject as empty string
      .gte('received_at', timeWindowStart)
      .lte('received_at', timeWindowEnd)
      .maybeSingle()

    if (fingerprintError) {
      console.error('[Deduplication] Error checking fingerprint:', fingerprintError)
      // No more strategies, allow insertion
    } else if (existingByFingerprint) {
      console.log('[Deduplication] Duplicate found via fingerprint:', {
        from_email: fromEmail,
        subject,
        received_at: receivedAt.toISOString(),
        existing_communication_id: existingByFingerprint.id,
        existing_received_at: existingByFingerprint.received_at,
        time_diff_ms: Math.abs(
          new Date(existingByFingerprint.received_at).getTime() - receivedAt.getTime()
        ),
      })
      return {
        isDuplicate: true,
        strategy: 'fingerprint',
        existingCommunicationId: existingByFingerprint.id,
        matchedOn: {
          fingerprint: {
            from_email: fromEmail,
            subject,
            received_at: receivedAt.toISOString(),
          },
        },
      }
    }
  }

  // No duplicates found via any strategy
  return {
    isDuplicate: false,
  }
}

/**
 * Get statistics about duplicate detection effectiveness
 */
export async function getDuplicateStats(): Promise<{
  total_emails: number
  unique_provider_message_ids: number
  unique_internet_message_ids: number
  missing_provider_message_id: number
  missing_internet_message_id: number
  missing_both_ids: number
  potential_fingerprint_duplicates: number
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('email_import_health')
    .select('*')
    .single()

  if (error) {
    console.error('[Deduplication Stats] Error fetching stats:', error)
    throw error
  }

  // Get potential fingerprint duplicates from the view
  const { data: potentialDuplicates, error: dupError } = await supabase
    .from('potential_duplicate_emails')
    .select('email_1_id')

  if (dupError) {
    console.error('[Deduplication Stats] Error fetching potential duplicates:', dupError)
  }

  return {
    total_emails: data.total_emails || 0,
    unique_provider_message_ids: data.unique_provider_message_ids || 0,
    unique_internet_message_ids: data.unique_internet_message_ids || 0,
    missing_provider_message_id: data.missing_provider_message_id || 0,
    missing_internet_message_id: data.missing_internet_message_id || 0,
    missing_both_ids: data.missing_both_ids || 0,
    potential_fingerprint_duplicates: potentialDuplicates?.length || 0,
  }
}

/**
 * Find and log potential duplicates that may have slipped through
 * Useful for debugging and auditing deduplication effectiveness
 */
export async function findPotentialDuplicates(limit = 50): Promise<any[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data, error } = await supabase
    .from('potential_duplicate_emails')
    .select('*')
    .limit(limit)

  if (error) {
    console.error('[Deduplication] Error finding potential duplicates:', error)
    throw error
  }

  return data || []
}
