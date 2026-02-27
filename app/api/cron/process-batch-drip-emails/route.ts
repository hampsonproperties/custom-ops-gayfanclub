import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Daily cron job to process batch drip email campaign
 * Phase 2: Automation & Discovery - Batch Drip Email Automation
 *
 * Email Schedule (from when Alibaba order number is added):
 * - Email 1: "Order in production" (Day 0 - immediate)
 * - Email 2: "Shipped from facility" (Day 7)
 * - Email 3: "Going through customs" (Day 14)
 * - Email 4: "Arrived at warehouse" (Day 21)
 *
 * Email 4 is skipped if Shopify fulfillment webhook fires (drip_email_4_skipped = true)
 *
 * Security: Requires CRON_SECRET authorization header
 */
export async function GET(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron request')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use service role key for cron job
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const results = {
      email1_sent: 0,
      email2_sent: 0,
      email3_sent: 0,
      email4_sent: 0,
      errors: [] as string[],
    }

    // ========================================================================
    // EMAIL 1: Order in Production (immediate when Alibaba # added)
    // ========================================================================
    const { data: batchesForEmail1, error: error1 } = await supabase
      .from('batches')
      .select('id, name, alibaba_order_number')
      .not('alibaba_order_number', 'is', null)
      .is('drip_email_1_sent_at', null)

    if (error1) {
      console.error('Error fetching batches for email 1:', error1)
      results.errors.push(`Email 1 fetch error: ${error1.message}`)
    } else {
      for (const batch of batchesForEmail1 || []) {
        try {
          await sendDripEmail(supabase, batch, 1)
          results.email1_sent++
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Email 1 for batch ${batch.id}: ${msg}`)
        }
      }
    }

    // ========================================================================
    // EMAIL 2: Shipped from Facility (Day 7)
    // ========================================================================
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: batchesForEmail2, error: error2 } = await supabase
      .from('batches')
      .select('id, name, alibaba_order_number, drip_email_1_sent_at')
      .not('alibaba_order_number', 'is', null)
      .not('drip_email_1_sent_at', 'is', null)
      .is('drip_email_2_sent_at', null)
      .lte('drip_email_1_sent_at', sevenDaysAgo.toISOString())

    if (error2) {
      console.error('Error fetching batches for email 2:', error2)
      results.errors.push(`Email 2 fetch error: ${error2.message}`)
    } else {
      for (const batch of batchesForEmail2 || []) {
        try {
          await sendDripEmail(supabase, batch, 2)
          results.email2_sent++
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Email 2 for batch ${batch.id}: ${msg}`)
        }
      }
    }

    // ========================================================================
    // EMAIL 3: Going Through Customs (Day 14)
    // ========================================================================
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

    const { data: batchesForEmail3, error: error3 } = await supabase
      .from('batches')
      .select('id, name, alibaba_order_number, drip_email_1_sent_at')
      .not('alibaba_order_number', 'is', null)
      .not('drip_email_1_sent_at', 'is', null)
      .is('drip_email_3_sent_at', null)
      .lte('drip_email_1_sent_at', fourteenDaysAgo.toISOString())

    if (error3) {
      console.error('Error fetching batches for email 3:', error3)
      results.errors.push(`Email 3 fetch error: ${error3.message}`)
    } else {
      for (const batch of batchesForEmail3 || []) {
        try {
          await sendDripEmail(supabase, batch, 3)
          results.email3_sent++
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Email 3 for batch ${batch.id}: ${msg}`)
        }
      }
    }

    // ========================================================================
    // EMAIL 4: Arrived at Warehouse (Day 21)
    // Skipped if drip_email_4_skipped = true (Shopify already sent tracking)
    // ========================================================================
    const twentyOneDaysAgo = new Date()
    twentyOneDaysAgo.setDate(twentyOneDaysAgo.getDate() - 21)

    const { data: batchesForEmail4, error: error4 } = await supabase
      .from('batches')
      .select('id, name, alibaba_order_number, drip_email_1_sent_at')
      .not('alibaba_order_number', 'is', null)
      .not('drip_email_1_sent_at', 'is', null)
      .is('drip_email_4_sent_at', null)
      .eq('drip_email_4_skipped', false)
      .lte('drip_email_1_sent_at', twentyOneDaysAgo.toISOString())

    if (error4) {
      console.error('Error fetching batches for email 4:', error4)
      results.errors.push(`Email 4 fetch error: ${error4.message}`)
    } else {
      for (const batch of batchesForEmail4 || []) {
        try {
          await sendDripEmail(supabase, batch, 4)
          results.email4_sent++
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Email 4 for batch ${batch.id}: ${msg}`)
        }
      }
    }

    console.log('Batch drip email processing complete:', results)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    })
  } catch (error) {
    console.error('Batch drip email cron error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process drip emails',
      },
      { status: 500 }
    )
  }
}

/**
 * Send a drip email for a batch
 */
async function sendDripEmail(
  supabase: any,
  batch: any,
  emailNumber: 1 | 2 | 3 | 4
): Promise<void> {
  // Get the template key for this email
  const templateKeys = {
    1: 'drip_email_1_production',
    2: 'drip_email_2_shipped',
    3: 'drip_email_3_customs',
    4: 'drip_email_4_warehouse',
  }
  const templateKey = templateKeys[emailNumber]

  // Get the template
  const { data: template, error: templateError } = await supabase
    .from('templates')
    .select('*')
    .eq('key', templateKey)
    .eq('is_active', true)
    .single()

  if (templateError || !template) {
    throw new Error(`Template ${templateKey} not found`)
  }

  // Get all work items in this batch to find customer emails
  const { data: batchItems, error: batchItemsError } = await supabase
    .from('batch_items')
    .select('work_item_id, work_items!inner(customer_email, customer_name)')
    .eq('batch_id', batch.id)

  if (batchItemsError) {
    throw new Error(`Failed to fetch batch items: ${batchItemsError.message}`)
  }

  // Get unique customer emails
  const customerEmails = new Set<string>()
  const customerNames: { [email: string]: string } = {}

  for (const item of batchItems || []) {
    if (item.work_items?.customer_email) {
      customerEmails.add(item.work_items.customer_email)
      if (item.work_items.customer_name) {
        customerNames[item.work_items.customer_email] = item.work_items.customer_name
      }
    }
  }

  if (customerEmails.size === 0) {
    console.log(`No customer emails found for batch ${batch.id}`)
    // Still mark as sent to avoid retry
    await updateDripEmailSentAt(supabase, batch.id, emailNumber)
    return
  }

  // Prepare merge fields
  const mergeFields = {
    batch_name: batch.name,
    alibaba_order_number: batch.alibaba_order_number,
  }

  // Replace merge fields in template
  let subject = template.subject_template
  let body = template.body_html_template

  for (const [key, value] of Object.entries(mergeFields)) {
    const placeholder = `{{${key}}}`
    subject = subject.replace(new RegExp(placeholder, 'g'), value)
    body = body.replace(new RegExp(placeholder, 'g'), value)
  }

  // Send email to each customer
  // TODO: Implement actual email sending via Microsoft Graph API
  // For now, just log and mark as sent
  console.log(`Sending drip email ${emailNumber} for batch ${batch.name} to ${customerEmails.size} customers`)
  console.log(`Subject: ${subject}`)
  console.log(`Recipients: ${Array.from(customerEmails).join(', ')}`)

  // TODO: Call Microsoft Graph API to send email
  // await fetch('/api/email/send', { ... })

  // Mark email as sent
  await updateDripEmailSentAt(supabase, batch.id, emailNumber)
}

/**
 * Update the drip_email_X_sent_at timestamp
 */
async function updateDripEmailSentAt(
  supabase: any,
  batchId: string,
  emailNumber: 1 | 2 | 3 | 4
): Promise<void> {
  const columnName = `drip_email_${emailNumber}_sent_at`

  const { error } = await supabase
    .from('batches')
    .update({ [columnName]: new Date().toISOString() })
    .eq('id', batchId)

  if (error) {
    throw new Error(`Failed to update ${columnName}: ${error.message}`)
  }
}
