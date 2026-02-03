import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Load .env.local
const envFile = readFileSync('.env.local', 'utf-8')
const envVars = {}
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envVars[match[1]] = match[2]
  }
})

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Import the categorization function
async function autoCategorizEmail(emailData) {
  const { from, subject = '', body = '', htmlBody = '' } = emailData
  const fromLower = from.toLowerCase()
  const subjectLower = subject.toLowerCase()
  const bodyLower = body.toLowerCase()
  const htmlLower = htmlBody.toLowerCase()
  
  // Notifications - System emails, order updates, shipping
  const notificationPatterns = [
    '@shopify.com',
    'no-reply@',
    'noreply@',
    'notifications@',
    'judge.me',
    'faire.com'
  ]
  
  const notificationKeywords = [
    'order #',
    'tracking',
    'shipped',
    'delivered',
    'confirmation',
    'receipt'
  ]
  
  for (const pattern of notificationPatterns) {
    if (fromLower.includes(pattern)) return 'notifications'
  }
  
  for (const keyword of notificationKeywords) {
    if (subjectLower.includes(keyword) || bodyLower.includes(keyword)) {
      return 'notifications'
    }
  }
  
  // Promotional - Marketing emails, sales, newsletters
  const promotionalPatterns = [
    'unsubscribe',
    'list-unsubscribe'
  ]
  
  const promotionalKeywords = [
    'sale',
    '% off',
    'discount',
    'deal',
    'offer',
    'limited time',
    'newsletter'
  ]
  
  for (const pattern of promotionalPatterns) {
    if (htmlLower.includes(pattern)) return 'promotional'
  }
  
  for (const keyword of promotionalKeywords) {
    if (subjectLower.includes(keyword)) return 'promotional'
  }
  
  // Default to primary
  return 'primary'
}

async function categorizAll() {
  console.log('Fetching all emails...')

  const { data: emails, error } = await supabase
    .from('communications')
    .select('id, from_email, subject, body_preview, body_html')
    .eq('direction', 'inbound')
  
  if (error) {
    console.error('Error fetching emails:', error)
    return
  }
  
  console.log(`Found ${emails.length} emails to categorize`)
  
  let updated = 0
  for (const email of emails) {
    const category = await autoCategorizEmail({
      from: email.from_email,
      subject: email.subject,
      body: email.body_preview || '',
      htmlBody: email.body_html || ''
    })
    
    const { error: updateError } = await supabase
      .from('communications')
      .update({ category })
      .eq('id', email.id)
    
    if (updateError) {
      console.error(`Error updating email ${email.id}:`, updateError)
    } else {
      updated++
      if (updated % 50 === 0) {
        console.log(`Progress: ${updated}/${emails.length} categorized`)
      }
    }
  }
  
  console.log(`\nDone! Categorized ${updated} emails`)
  
  // Show category breakdown
  const { data: breakdown } = await supabase
    .from('communications')
    .select('category')
    .eq('direction', 'inbound')
  
  const counts = breakdown.reduce((acc, email) => {
    acc[email.category] = (acc[email.category] || 0) + 1
    return acc
  }, {})
  
  console.log('\nCategory breakdown:')
  console.log(counts)
}

categorizAll().catch(console.error)
