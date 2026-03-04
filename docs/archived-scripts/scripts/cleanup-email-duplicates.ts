/**
 * Email Duplicate Cleanup Script
 *
 * Removes duplicate emails from the communications table using a 3-strategy approach:
 * 1. provider_message_id duplicates
 * 2. internet_message_id duplicates
 * 3. Fingerprint duplicates (from_email + subject + received_at within 5 seconds)
 *
 * For each duplicate group, keeps the oldest record (by created_at) and deletes the rest.
 *
 * Usage:
 *   npx tsx scripts/cleanup-email-duplicates.ts [--dry-run]
 *
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface DuplicateGroup {
  key: string
  strategy: 'provider_message_id' | 'internet_message_id' | 'fingerprint'
  emails: Array<{
    id: string
    created_at: string
    from_email: string
    subject: string
    received_at: string
  }>
}

async function findProviderMessageIdDuplicates(): Promise<DuplicateGroup[]> {
  console.log('\n📋 Checking for provider_message_id duplicates...')

  const { data, error } = await supabase
    .from('communications')
    .select('id, provider_message_id, created_at, from_email, subject, received_at')
    .not('provider_message_id', 'is', null)
    .order('provider_message_id')
    .order('created_at')

  if (error) {
    console.error('❌ Error fetching communications:', error)
    throw error
  }

  // Group by provider_message_id
  const groups = new Map<string, typeof data>()
  data.forEach((email) => {
    const key = email.provider_message_id!
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(email)
  })

  // Filter to only duplicate groups (2+ emails with same ID)
  const duplicates: DuplicateGroup[] = []
  groups.forEach((emails, key) => {
    if (emails.length > 1) {
      duplicates.push({
        key,
        strategy: 'provider_message_id',
        emails,
      })
    }
  })

  console.log(`   Found ${duplicates.length} duplicate groups`)
  return duplicates
}

async function findInternetMessageIdDuplicates(): Promise<DuplicateGroup[]> {
  console.log('\n📋 Checking for internet_message_id duplicates...')

  const { data, error } = await supabase
    .from('communications')
    .select('id, internet_message_id, created_at, from_email, subject, received_at')
    .not('internet_message_id', 'is', null)
    .order('internet_message_id')
    .order('created_at')

  if (error) {
    console.error('❌ Error fetching communications:', error)
    throw error
  }

  // Group by internet_message_id
  const groups = new Map<string, typeof data>()
  data.forEach((email) => {
    const key = email.internet_message_id!
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(email)
  })

  // Filter to only duplicate groups
  const duplicates: DuplicateGroup[] = []
  groups.forEach((emails, key) => {
    if (emails.length > 1) {
      duplicates.push({
        key,
        strategy: 'internet_message_id',
        emails,
      })
    }
  })

  console.log(`   Found ${duplicates.length} duplicate groups`)
  return duplicates
}

async function findFingerprintDuplicates(): Promise<DuplicateGroup[]> {
  console.log('\n📋 Checking for fingerprint duplicates...')

  const { data, error } = await supabase
    .from('communications')
    .select('id, from_email, subject, received_at, created_at')
    .not('from_email', 'is', null)
    .not('subject', 'is', null)
    .not('received_at', 'is', null)
    .order('from_email')
    .order('subject')
    .order('received_at')

  if (error) {
    console.error('❌ Error fetching communications:', error)
    throw error
  }

  // Group by fingerprint (from_email + subject + received_at within 5 seconds)
  const duplicates: DuplicateGroup[] = []
  const processed = new Set<string>()

  for (let i = 0; i < data.length; i++) {
    const email1 = data[i]
    if (processed.has(email1.id)) continue

    const group = [email1]
    processed.add(email1.id)

    // Look ahead for emails with same from_email and subject
    for (let j = i + 1; j < data.length; j++) {
      const email2 = data[j]
      if (processed.has(email2.id)) continue

      // Break if from_email or subject changed (data is sorted)
      if (email2.from_email !== email1.from_email || email2.subject !== email1.subject) {
        break
      }

      // Check if received_at is within 5 seconds
      const timeDiff = Math.abs(
        new Date(email2.received_at).getTime() - new Date(email1.received_at).getTime()
      )
      if (timeDiff <= 5000) {
        group.push(email2)
        processed.add(email2.id)
      }
    }

    if (group.length > 1) {
      duplicates.push({
        key: `${email1.from_email}|${email1.subject}|${email1.received_at}`,
        strategy: 'fingerprint',
        emails: group,
      })
    }
  }

  console.log(`   Found ${duplicates.length} duplicate groups`)
  return duplicates
}

async function deleteDuplicates(groups: DuplicateGroup[], dryRun: boolean): Promise<void> {
  let totalDeleted = 0
  const idsToDelete: string[] = []

  console.log('\n🗑️  Processing duplicates...')

  for (const group of groups) {
    // Sort by created_at to keep the oldest
    const sorted = [...group.emails].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const keepEmail = sorted[0]
    const deleteEmails = sorted.slice(1)

    console.log(`\n   Group (${group.strategy}): ${group.key}`)
    console.log(`   ✓ KEEP: ${keepEmail.id} (created ${keepEmail.created_at})`)

    for (const email of deleteEmails) {
      console.log(`   ✗ DELETE: ${email.id} (created ${email.created_at})`)
      idsToDelete.push(email.id)
    }

    totalDeleted += deleteEmails.length
  }

  if (idsToDelete.length === 0) {
    console.log('\n✅ No duplicates to delete')
    return
  }

  if (dryRun) {
    console.log(`\n🔍 DRY RUN: Would delete ${totalDeleted} duplicate emails`)
    console.log('   Run without --dry-run to actually delete')
  } else {
    console.log(`\n🗑️  Deleting ${totalDeleted} duplicate emails...`)

    // Delete in batches of 100
    const batchSize = 100
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize)
      const { error } = await supabase
        .from('communications')
        .delete()
        .in('id', batch)

      if (error) {
        console.error(`❌ Error deleting batch ${i / batchSize + 1}:`, error)
        throw error
      }

      console.log(`   Deleted batch ${i / batchSize + 1} (${batch.length} emails)`)
    }

    console.log(`\n✅ Successfully deleted ${totalDeleted} duplicate emails`)
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  console.log('=' .repeat(60))
  console.log('📧 EMAIL DUPLICATE CLEANUP SCRIPT')
  console.log('=' .repeat(60))
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will delete duplicates)'}`)

  // Get initial stats
  const { data: beforeStats } = await supabase
    .from('email_import_health')
    .select('*')
    .single()

  if (beforeStats) {
    console.log('\n📊 Current Email Stats:')
    console.log(`   Total emails: ${beforeStats.total_emails}`)
    console.log(`   Unique provider_message_ids: ${beforeStats.unique_provider_message_ids}`)
    console.log(`   Unique internet_message_ids: ${beforeStats.unique_internet_message_ids}`)
    console.log(`   Missing provider_message_id: ${beforeStats.missing_provider_message_id}`)
    console.log(`   Missing internet_message_id: ${beforeStats.missing_internet_message_id}`)
  }

  // Find all duplicates using 3 strategies
  const providerDuplicates = await findProviderMessageIdDuplicates()
  const internetDuplicates = await findInternetMessageIdDuplicates()
  const fingerprintDuplicates = await findFingerprintDuplicates()

  const allDuplicates = [
    ...providerDuplicates,
    ...internetDuplicates,
    ...fingerprintDuplicates,
  ]

  console.log('\n' + '='.repeat(60))
  console.log('📊 SUMMARY:')
  console.log(`   provider_message_id duplicates: ${providerDuplicates.length} groups`)
  console.log(`   internet_message_id duplicates: ${internetDuplicates.length} groups`)
  console.log(`   Fingerprint duplicates: ${fingerprintDuplicates.length} groups`)
  console.log(`   Total duplicate groups: ${allDuplicates.length}`)
  console.log('='.repeat(60))

  if (allDuplicates.length === 0) {
    console.log('\n✅ No duplicates found. Database is clean!')
    return
  }

  // Delete duplicates (or show what would be deleted)
  await deleteDuplicates(allDuplicates, dryRun)

  // Get final stats (if not dry run)
  if (!dryRun) {
    const { data: afterStats } = await supabase
      .from('email_import_health')
      .select('*')
      .single()

    if (afterStats) {
      console.log('\n📊 Final Email Stats:')
      console.log(`   Total emails: ${afterStats.total_emails}`)
      console.log(`   Unique provider_message_ids: ${afterStats.unique_provider_message_ids}`)
      console.log(`   Unique internet_message_ids: ${afterStats.unique_internet_message_ids}`)
      console.log(
        `   Emails removed: ${beforeStats?.total_emails - afterStats.total_emails || 0}`
      )
    }
  }

  console.log('\n✅ Script completed')
}

main().catch((error) => {
  console.error('\n❌ Script failed:', error)
  process.exit(1)
})
