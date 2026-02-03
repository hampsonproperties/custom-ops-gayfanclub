/**
 * Regenerate email previews for all existing emails
 * Run with: node scripts/regenerate-email-previews.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const { htmlToPlainText, smartTruncate } = require('../lib/utils/html-entities')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function regeneratePreviews() {
  console.log('Fetching all emails...')

  // Get all emails
  const { data: emails, error } = await supabase
    .from('communications')
    .select('id, body_html, body_preview')
    .not('body_html', 'is', null)

  if (error) {
    console.error('Error fetching emails:', error)
    return
  }

  console.log(`Found ${emails.length} emails to process`)

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const email of emails) {
    // Skip if preview already exists and looks good
    if (email.body_preview && email.body_preview.length > 50 && !email.body_preview.includes('<')) {
      skipped++
      continue
    }

    try {
      // Generate new preview
      const plainText = htmlToPlainText(email.body_html)
      const newPreview = smartTruncate(plainText, 200)

      // Update the email
      const { error: updateError } = await supabase
        .from('communications')
        .update({ body_preview: newPreview })
        .eq('id', email.id)

      if (updateError) {
        console.error(`Error updating email ${email.id}:`, updateError)
        errors++
      } else {
        updated++
        if (updated % 10 === 0) {
          console.log(`Progress: ${updated} updated, ${skipped} skipped, ${errors} errors`)
        }
      }
    } catch (e) {
      console.error(`Error processing email ${email.id}:`, e.message)
      errors++
    }
  }

  console.log('\n✅ Done!')
  console.log(`Updated: ${updated}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Errors: ${errors}`)
}

regeneratePreviews().catch(console.error)
