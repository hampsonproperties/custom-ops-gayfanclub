import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Create test work item
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .insert({
        type: 'customify_order',
        source: 'manual',
        title: '🧪 TEST ORDER - Safe to Delete',
        customer_name: 'Test Customer',
        customer_email: email,
        status: 'in_progress',
        priority: 'normal',
        shopify_order_number: 'TEST-' + Date.now(),
        quantity: 100,
        grip_color: 'Black',
        event_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
      })
      .select()
      .single()

    if (workItemError || !workItem) {
      console.error('Failed to create test work item:', workItemError)
      return NextResponse.json(
        { error: 'Failed to create test work item' },
        { status: 500 }
      )
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
      console.error('Failed to create test files:', filesError)
      // Don't fail the whole request, just log it
    }

    // Create a timeline event
    await supabase.from('timeline_events').insert({
      work_item_id: workItem.id,
      type: 'work_item_created',
      title: 'Test Order Created',
      description: `Test Customify order created for testing approval email feature`,
      user: 'System',
      timestamp: new Date().toISOString(),
    })

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
    console.error('Create test order error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create test order',
      },
      { status: 500 }
    )
  }
}
