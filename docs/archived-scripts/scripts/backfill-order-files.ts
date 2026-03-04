/**
 * Manually import Customify files for an existing order
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function downloadAndStoreFile(
  supabase: any,
  externalUrl: string,
  workItemId: string,
  filename: string
): Promise<{ path: string; sizeBytes: number } | null> {
  try {
    let url = externalUrl
    if (url.startsWith('//')) {
      url = `https:${url}`
    }

    console.log(`   Downloading: ${filename}...`)

    const response = await fetch(url)
    if (!response.ok) {
      console.error(`   ❌ Failed: ${response.status} ${response.statusText}`)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const sizeBytes = buffer.length

    let extension = 'png'
    const urlExtension = url.split('.').pop()?.toLowerCase()
    if (urlExtension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'].includes(urlExtension)) {
      extension = urlExtension
    }

    const storagePath = `work-items/${workItemId}/${filename}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('custom-ops-files')
      .upload(storagePath, buffer, {
        contentType: response.headers.get('content-type') || 'image/png',
        upsert: true,
      })

    if (uploadError) {
      console.error(`   ❌ Upload failed:`, uploadError.message)
      return null
    }

    console.log(`   ✅ Stored (${(sizeBytes / 1024).toFixed(1)} KB)`)
    return { path: storagePath, sizeBytes }
  } catch (error) {
    console.error(`   ❌ Error:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

async function backfillFiles(orderNumber: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  console.log(`\n🔍 Finding work item for order ${orderNumber}...`)

  const { data: workItem } = await supabase
    .from('work_items')
    .select('*')
    .or(`shopify_order_number.eq.${orderNumber},design_fee_order_number.eq.${orderNumber}`)
    .single()

  if (!workItem) {
    console.error('❌ Work item not found')
    process.exit(1)
  }

  console.log(`   Work Item ID: ${workItem.id}`)
  console.log(`   Type: ${workItem.type}`)

  // Check existing files
  const { data: existingFiles } = await supabase
    .from('files')
    .select('id')
    .eq('work_item_id', workItem.id)

  if (existingFiles && existingFiles.length > 0) {
    console.log(`\n⚠️  Work item already has ${existingFiles.length} file(s). Skipping import.`)
    process.exit(0)
  }

  // Get webhook payload
  const { data: webhook } = await supabase
    .from('webhook_events')
    .select('payload')
    .eq('external_event_id', workItem.shopify_order_id || workItem.design_fee_order_id)
    .single()

  if (!webhook) {
    console.error('❌ Webhook payload not found')
    process.exit(1)
  }

  const order = webhook.payload

  console.log(`\n📦 Extracting files from webhook payload...`)

  const customifyFiles: Array<{ kind: string; url: string; filename: string }> = []

  for (const item of order.line_items || []) {
    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        const propName = prop.name?.toLowerCase() || ''
        const propValue = prop.value

        if (propName.includes('final design') && propValue?.includes('http')) {
          customifyFiles.push({ kind: 'design', url: propValue, filename: `final-design-${propName}` })
        } else if (propName.includes('design ') && !propName.includes('final') && propValue?.includes('http')) {
          customifyFiles.push({ kind: 'preview', url: propValue, filename: `design-${propName}` })
        } else if (propName.includes('cst-original-image') && propValue?.includes('http')) {
          customifyFiles.push({ kind: 'other', url: propValue, filename: `original-${propName}` })
        } else if (propName.includes('preview') && propValue?.includes('http')) {
          customifyFiles.push({ kind: 'preview', url: propValue, filename: `preview-${propName}` })
        }
      }
    }
  }

  console.log(`   Found ${customifyFiles.length} file(s)`)

  if (customifyFiles.length === 0) {
    console.log('\n⚠️  No Customify files found in webhook payload')
    process.exit(0)
  }

  console.log(`\n⬇️  Downloading and storing files...`)

  const fileRecords = []

  for (let index = 0; index < customifyFiles.length; index++) {
    const file = customifyFiles[index]

    const storedFile = await downloadAndStoreFile(
      supabase,
      file.url,
      workItem.id,
      file.filename
    )

    if (storedFile) {
      fileRecords.push({
        work_item_id: workItem.id,
        kind: file.kind,
        version: index + 1,
        original_filename: file.filename,
        normalized_filename: file.filename,
        storage_bucket: 'custom-ops-files',
        storage_path: storedFile.path,
        mime_type: 'image/png',
        size_bytes: storedFile.sizeBytes,
        uploaded_by_user_id: null,
        note: 'Backfilled from webhook payload',
      })
    } else {
      fileRecords.push({
        work_item_id: workItem.id,
        kind: file.kind,
        version: index + 1,
        original_filename: file.filename,
        normalized_filename: file.filename,
        storage_bucket: 'customify',
        storage_path: file.url,
        mime_type: 'image/png',
        size_bytes: null,
        uploaded_by_user_id: null,
        note: 'Customify file - download failed, external URL only',
      })
    }
  }

  console.log(`\n💾 Saving ${fileRecords.length} file record(s) to database...`)

  const { error } = await supabase.from('files').insert(fileRecords)

  if (error) {
    console.error('❌ Failed to insert files:', error)
    process.exit(1)
  }

  console.log(`\n✅ Successfully imported ${fileRecords.length} file(s)!`)
  console.log(`\n🔗 View at: https://custom-ops-gayfanclub.vercel.app/work-items/${workItem.id}`)
}

const orderNumber = process.argv[2]

if (!orderNumber) {
  console.error('Usage: npx tsx scripts/backfill-order-files.ts <order-number>')
  process.exit(1)
}

backfillFiles(orderNumber).catch(console.error)
