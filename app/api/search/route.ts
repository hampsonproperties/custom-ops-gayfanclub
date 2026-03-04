import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('api-search')

/**
 * Universal Search API
 * Phase 2: Automation & Discovery - Universal Search (Cmd+K)
 *
 * Searches across:
 * - Customers (name, email, organization_name)
 * - Work Items (title, customer_name)
 * - Communications (subject, from_email)
 * - Files (filename)
 * - Batches (name, alibaba_order_number)
 *
 * Returns grouped results with type, id, display text, and link
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] })
    }

    const supabase = await createClient()
    const searchQuery = `%${query}%`

    // Run all 5 searches in parallel instead of sequentially
    const [
      customersResult,
      workItemsResult,
      communicationsResult,
      filesResult,
      batchesResult,
    ] = await Promise.all([
      supabase
        .from('customers')
        .select('id, email, first_name, last_name, display_name, organization_name')
        .or(`email.ilike.${searchQuery},first_name.ilike.${searchQuery},last_name.ilike.${searchQuery},display_name.ilike.${searchQuery},organization_name.ilike.${searchQuery}`)
        .limit(10),
      supabase
        .from('work_items')
        .select('id, title, customer_name, status, type')
        .or(`title.ilike.${searchQuery},customer_name.ilike.${searchQuery}`)
        .limit(10),
      supabase
        .from('communications')
        .select('id, subject, from_email, work_item_id, direction')
        .or(`subject.ilike.${searchQuery},from_email.ilike.${searchQuery}`)
        .limit(10),
      supabase
        .from('files')
        .select('id, original_filename, kind, work_item_id')
        .ilike('original_filename', searchQuery)
        .limit(10),
      supabase
        .from('batches')
        .select('id, name, alibaba_order_number, status')
        .or(`name.ilike.${searchQuery},alibaba_order_number.ilike.${searchQuery}`)
        .limit(10),
    ])

    const results: any[] = []

    // Process customers
    if (!customersResult.error && customersResult.data) {
      for (const customer of customersResult.data) {
        const name = customer.display_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || customer.email
        results.push({
          id: customer.id,
          type: 'customer',
          title: name,
          subtitle: customer.organization_name || customer.email,
          url: `/customers/${customer.id}`,
        })
      }
    }

    // Process work items
    if (!workItemsResult.error && workItemsResult.data) {
      for (const item of workItemsResult.data) {
        results.push({
          id: item.id,
          type: 'work_item',
          title: item.title || `${item.type} - ${item.customer_name || 'Unknown'}`,
          subtitle: `${item.status} • ${item.customer_name || 'Unknown customer'}`,
          url: `/work-items/${item.id}`,
        })
      }
    }

    // Process communications
    if (!communicationsResult.error && communicationsResult.data) {
      for (const comm of communicationsResult.data) {
        results.push({
          id: comm.id,
          type: 'communication',
          title: comm.subject || '(No subject)',
          subtitle: `${comm.direction === 'inbound' ? 'From' : 'To'}: ${comm.from_email}`,
          url: comm.work_item_id ? `/work-items/${comm.work_item_id}` : `/inbox`,
        })
      }
    }

    // Process files
    if (!filesResult.error && filesResult.data) {
      for (const file of filesResult.data) {
        results.push({
          id: file.id,
          type: 'file',
          title: file.original_filename,
          subtitle: `${file.kind} file`,
          url: `/work-items/${file.work_item_id}`,
        })
      }
    }

    // Process batches
    if (!batchesResult.error && batchesResult.data) {
      for (const batch of batchesResult.data) {
        results.push({
          id: batch.id,
          type: 'batch',
          title: batch.name,
          subtitle: batch.alibaba_order_number ? `Alibaba: ${batch.alibaba_order_number}` : batch.status,
          url: `/batches/${batch.id}`,
        })
      }
    }

    // Return results
    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    })
  } catch (error) {
    log.error('Search error', { error })
    return serverError(error instanceof Error ? error.message : 'Search failed')
  }
}
