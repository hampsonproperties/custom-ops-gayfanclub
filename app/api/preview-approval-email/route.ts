import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTemplateByKey, renderTemplate } from '@/lib/email/templates'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { workItemId, fileId } = await request.json()

    if (!workItemId || !fileId) {
      return NextResponse.json(
        { error: 'Missing required fields: workItemId, fileId' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch work item details
    const { data: workItem, error: workItemError } = await supabase
      .from('work_items')
      .select('*')
      .eq('id', workItemId)
      .single()

    if (workItemError || !workItem) {
      return NextResponse.json(
        { error: 'Work item not found' },
        { status: 404 }
      )
    }

    // Fetch file details
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Generate signed URL for proof image (7-day expiry)
    console.log('Attempting to generate signed URL:', {
      bucket: file.storage_bucket,
      path: file.storage_path,
    })

    const { data: signedUrlData, error: signedUrlError } = await supabase
      .storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 604800) // 7 days in seconds

    if (signedUrlError || !signedUrlData) {
      console.error('Signed URL error:', signedUrlError)
      return NextResponse.json(
        {
          error: 'Failed to generate signed URL for proof image',
          details: signedUrlError?.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    const proofImageUrl = signedUrlData.signedUrl

    // Load and render template
    const template = await getTemplateByKey('customify-proof-approval')

    if (!template) {
      return NextResponse.json(
        { error: 'Email template not found' },
        { status: 500 }
      )
    }

    // Generate placeholder links for preview
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const approveLink = `${baseUrl}/approve-proof?token=PREVIEW_APPROVE_TOKEN`
    const rejectLink = `${baseUrl}/approve-proof?token=PREVIEW_REJECT_TOKEN`

    const { subject, body } = renderTemplate(template, {
      customerName: workItem.customer_name || 'there',
      orderNumber: workItem.shopify_order_number || workItem.id,
      proofImageUrl,
      approveLink,
      rejectLink,
    })

    return NextResponse.json({
      success: true,
      subject,
      body,
      fileInfo: {
        filename: file.original_filename,
        kind: file.kind,
        version: file.version,
      },
    })
  } catch (error) {
    console.error('Preview approval email error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to preview approval email',
      },
      { status: 500 }
    )
  }
}
