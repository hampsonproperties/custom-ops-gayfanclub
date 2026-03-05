import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { createTestOrderBody } from '@/lib/api/schemas'
import { serverError, unauthorized } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const log = logger('api-create-test-order')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return unauthorized()

    const bodyResult = validateBody(await request.json(), createTestOrderBody)
    if (bodyResult.error) return bodyResult.error
    const { email } = bodyResult.data

    const supabase = createServiceClient(supabaseUrl, supabaseServiceKey)

    // Create test work item
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .insert({
        type: 'customify_order',
        source: 'manual',
        title: '🧪 TEST ORDER - Safe to Delete',
        customer_name: 'Test Customer',
        customer_email: email,
        status: 'needs_design_review',
        priority: 'normal',
        shopify_order_number: 'TEST-' + Date.now(),
        quantity: 100,
        grip_color: 'Black',
        event_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      })
      .select()
      .single()

    if (workItemError || !workItem) {
      log.error('Failed to create test work item', { error: workItemError })
      return serverError('Failed to create test work item')
    }

    // Create test files with different kinds
    const testFiles = [
      {
        kind: 'preview',
        filename: 'test-preview-design.png',
        note: 'Test preview file from Customify',
      },
      {
        kind: 'design',
        filename: 'test-final-design.png',
        note: 'Test final design file',
      },
      {
        kind: 'other',
        filename: 'test-original-image.jpg',
        note: 'Test original customer image',
      },
      {
        kind: 'proof',
        filename: 'test-proof-manual.png',
        note: 'Test manually uploaded proof',
      },
    ]

    // Use a placeholder image URL (a small 1x1 transparent PNG)
    const placeholderImageUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    const fileInserts = testFiles.map((file, index) => ({
      work_item_id: workItem.id,
      kind: file.kind,
      version: index + 1,
      original_filename: file.filename,
      normalized_filename: file.filename,
      storage_bucket: 'customify',
      storage_path: placeholderImageUrl,
      mime_type: file.filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
      size_bytes: 100,
      uploaded_by_user_id: null,
      note: file.note,
    }))

    const { error: filesError } = await supabase
      .from('files')
      .insert(fileInserts)

    if (filesError) {
      log.error('Failed to create test files', { error: filesError })
      // Don't fail the whole request, just log it
    }

    return NextResponse.json({
      success: true,
      workItem: {
        id: workItem.id,
        customer_name: workItem.customer_name,
        customer_email: workItem.customer_email,
        shopify_order_number: workItem.shopify_order_number,
      },
      message: 'Test order created successfully! You can now test the approval email feature.',
      filesCreated: testFiles.length,
    })
  } catch (error) {
    log.error('Create test order error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to create test order')
  }
}
