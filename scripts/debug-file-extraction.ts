/**
 * Debug file extraction from webhook payload
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function debugFileExtraction(orderNumber: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get work item
  const { data: workItem } = await supabase
    .from('work_items')
    .select('shopify_order_id')
    .eq('shopify_order_number', orderNumber)
    .single()

  if (!workItem) {
    console.error('❌ Work item not found')
    process.exit(1)
  }

  // Get webhook payload
  const { data: webhook } = await supabase
    .from('webhook_events')
    .select('payload')
    .eq('external_event_id', workItem.shopify_order_id)
    .single()

  if (!webhook) {
    console.error('❌ Webhook not found')
    process.exit(1)
  }

  const order = webhook.payload

  console.log(`\n🔍 Simulating file extraction logic...\n`)

  const customifyFiles: Array<{ kind: string; url: string; filename: string }> = []

  for (const item of order.line_items || []) {
    const title = item.title?.toLowerCase() || ''
    console.log(`📦 Line Item: "${item.title}"`)

    const hasCustomifyProps = item.properties && Array.isArray(item.properties) &&
      item.properties.some((prop: any) => prop.name?.toLowerCase().includes('customify'))

    const isCustomItem = hasCustomifyProps ||
      title.includes('customify') ||
      title.includes('custom') ||
      title.includes('bulk')

    console.log(`   Is Custom Item: ${isCustomItem}`)
    console.log(`   Has Customify Props: ${hasCustomifyProps}`)

    if (!isCustomItem) {
      console.log(`   ⏭️  Skipping (not custom)\n`)
      continue
    }

    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      console.log(`   Properties (${props.length}):`)

      for (const prop of props) {
        const propName = prop.name?.toLowerCase() || ''
        const propValue = prop.value || ''

        console.log(`      - "${prop.name}" (lowercase: "${propName}")`)

        // This is the actual file extraction logic from the webhook handler
        if (propName.includes('final design') && propValue?.includes('http')) {
          const file = { kind: 'design', url: propValue, filename: `final-design-${propName}` }
          customifyFiles.push(file)
          console.log(`        ✅ Matched: final design (kind: design)`)
        } else if (propName.includes('design ') && !propName.includes('final') && propValue?.includes('http')) {
          const file = { kind: 'preview', url: propValue, filename: `design-${propName}` }
          customifyFiles.push(file)
          console.log(`        ✅ Matched: design (kind: preview)`)
        } else if (propName.includes('cst-original-image') && propValue?.includes('http')) {
          const file = { kind: 'other', url: propValue, filename: `original-${propName}` }
          customifyFiles.push(file)
          console.log(`        ✅ Matched: original image (kind: other)`)
        } else if (propName.includes('preview') && propValue?.includes('http')) {
          const file = { kind: 'preview', url: propValue, filename: `preview-${propName}` }
          customifyFiles.push(file)
          console.log(`        ✅ Matched: preview (kind: preview)`)
        } else if (propValue?.includes('http')) {
          console.log(`        ⚠️  Has URL but didn't match any pattern`)
        }
      }
    }

    console.log()
  }

  console.log(`\n📊 Results:`)
  console.log(`   Files Extracted: ${customifyFiles.length}`)

  if (customifyFiles.length > 0) {
    console.log(`\n   Files:`)
    for (const file of customifyFiles) {
      console.log(`      - ${file.filename} (${file.kind})`)
      console.log(`        URL: ${file.url.substring(0, 80)}...`)
    }
  }
}

const orderNumber = process.argv[2]

if (!orderNumber) {
  console.error('Usage: npx tsx scripts/debug-file-extraction.ts <order-number>')
  process.exit(1)
}

debugFileExtraction(orderNumber).catch(console.error)
