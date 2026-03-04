/**
 * Run migration using direct PostgreSQL connection
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { Client } from 'pg'
import { readFileSync } from 'fs'

config({ path: resolve(process.cwd(), '.env.local') })

// Construct PostgreSQL connection string from Supabase URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Extract project ref from Supabase URL
const projectRef = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('Could not extract project ref from Supabase URL')
  process.exit(1)
}

async function main() {
  console.log('🚀 Running Lead-Focused System Migration\n')

  const connectionString = `postgresql://postgres.${projectRef}:${serviceKey.split('.')[2]}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

  console.log('Connecting to database...')
  const client = new Client({ connectionString })

  try {
    await client.connect()
    console.log('✅ Connected!\n')

    // Read migration SQL
    const migrationSQL = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260222000001_lead_focused_system.sql'),
      'utf-8'
    )

    console.log('Executing migration SQL...\n')
    const result = await client.query(migrationSQL)

    console.log('\n✅ Migration completed successfully!')

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
