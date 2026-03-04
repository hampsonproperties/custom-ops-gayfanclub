/**
 * Run Lead-Focused Migration Step by Step
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runSQL(sql: string, description: string) {
  console.log(`\n📝 ${description}...`)
  try {
    const { error } = await supabase.rpc('exec', { sql })
    if (error) throw error
    console.log(`   ✅ Success`)
  } catch (err: any) {
    // Some errors are OK (like "already exists")
    if (err.message?.includes('already exists') || err.code === '42P07') {
      console.log(`   ⏭️  Skipped (already exists)`)
    } else {
      console.error(`   ❌ Error:`, err.message)
      throw err
    }
  }
}

async function main() {
  console.log('🚀 Running Lead-Focused System Migration\n')
  console.log('='.repeat(60))

  // 1. Create work_item_notes table
  await runSQL(`
    CREATE TABLE IF NOT EXISTS work_item_notes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      author_email TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_work_item_notes_work_item ON work_item_notes(work_item_id);
    CREATE INDEX IF NOT EXISTS idx_work_item_notes_created ON work_item_notes(created_at DESC);
  `, 'Create work_item_notes table')

  // 2. Add assignment fields
  await runSQL(`
    ALTER TABLE work_items
    ADD COLUMN IF NOT EXISTS assigned_to_email TEXT,
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS assigned_by_email TEXT;
  `, 'Add assignment fields to work_items')

  await runSQL(`
    CREATE INDEX IF NOT EXISTS idx_work_items_assigned
    ON work_items(assigned_to_email) WHERE closed_at IS NULL;
  `, 'Create assignment index')

  // 3. Create tags table
  await runSQL(`
    CREATE TABLE IF NOT EXISTS tags (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `, 'Create tags table')

  // 4. Create work_item_tags junction table
  await runSQL(`
    CREATE TABLE IF NOT EXISTS work_item_tags (
      work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      PRIMARY KEY (work_item_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_work_item_tags_work_item ON work_item_tags(work_item_id);
    CREATE INDEX IF NOT EXISTS idx_work_item_tags_tag ON work_item_tags(tag_id);
  `, 'Create work_item_tags junction table')

  // 5. Seed tags
  await runSQL(`
    INSERT INTO tags (name, color) VALUES
      ('VIP', '#ef4444'),
      ('Rush', '#f97316'),
      ('Event', '#8b5cf6'),
      ('Wholesale', '#06b6d4'),
      ('Design-Heavy', '#ec4899'),
      ('Repeat Customer', '#10b981')
    ON CONFLICT (name) DO NOTHING;
  `, 'Seed common tags')

  // 6. Add value fields
  await runSQL(`
    ALTER TABLE work_items
    ADD COLUMN IF NOT EXISTS estimated_value DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS actual_value DECIMAL(10,2);
  `, 'Add value tracking fields')

  await runSQL(`
    CREATE INDEX IF NOT EXISTS idx_work_items_value
    ON work_items(estimated_value DESC NULLS LAST) WHERE closed_at IS NULL;
  `, 'Create value index')

  // 7. Add activity tracking
  await runSQL(`
    ALTER TABLE work_items
    ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    CREATE INDEX IF NOT EXISTS idx_work_items_activity
    ON work_items(last_activity_at DESC) WHERE closed_at IS NULL;
  `, 'Add activity tracking')

  // 8. Archive junk conversations
  console.log(`\n🗑️  Archiving junk conversations...`)
  const { data: archivedCount } = await supabase.rpc('archive_junk_conversations')
  console.log(`   ✅ Archived ${archivedCount || 0} junk conversations`)

  // 9. Grant permissions
  await runSQL(`
    GRANT ALL ON work_item_notes TO authenticated;
    GRANT ALL ON tags TO authenticated;
    GRANT ALL ON work_item_tags TO authenticated;
  `, 'Grant permissions')

  console.log('\n' + '='.repeat(60))
  console.log('✅ Migration complete!\n')
  console.log('Database is ready for lead-focused UI')
}

// Create the archive function first
async function setupFunctions() {
  await runSQL(`
    CREATE OR REPLACE FUNCTION archive_junk_conversations()
    RETURNS INTEGER AS $$
    DECLARE
      archived_count INTEGER;
    BEGIN
      WITH junk_conversations AS (
        SELECT DISTINCT c.conversation_id
        FROM communications c
        WHERE c.conversation_id IS NOT NULL
          AND c.category IN ('notifications', 'promotional', 'spam')
          AND NOT EXISTS (
            SELECT 1 FROM communications c2
            WHERE c2.conversation_id = c.conversation_id
            AND c2.category = 'primary'
          )
      )
      UPDATE conversations
      SET status = 'archived'
      WHERE status = 'active'
        AND work_item_id IS NULL
        AND id IN (SELECT conversation_id FROM junk_conversations);

      GET DIAGNOSTICS archived_count = ROW_COUNT;
      RETURN archived_count;
    END;
    $$ LANGUAGE plpgsql;
  `, 'Create archive_junk_conversations function')
}

setupFunctions().then(() => main()).catch((err) => {
  console.error('\n❌ Migration failed:', err)
  process.exit(1)
})
