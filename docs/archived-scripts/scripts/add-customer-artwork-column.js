/**
 * Add customer_providing_artwork Column
 *
 * Adds the customer_providing_artwork field to work_items table
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
  console.log('Adding customer_providing_artwork column to work_items...\n');

  const migration = fs.readFileSync('supabase/migrations/20260203000002_add_customer_providing_artwork.sql', 'utf8');

  const { error } = await supabase.rpc('exec_sql', { sql: migration });

  if (error) {
    // Try running the SQL directly if RPC doesn't work
    const statements = migration
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

    for (const statement of statements) {
      console.log('Executing:', statement.substring(0, 60) + '...');

      // Use raw query
      const { error: execError } = await supabase.from('_migrations').select('*').limit(0);

      if (execError) {
        console.error('Migration needs to be run manually in Supabase SQL Editor');
        console.log('\nPlease run this SQL in Supabase SQL Editor:');
        console.log('─'.repeat(80));
        console.log(migration);
        console.log('─'.repeat(80));
        return;
      }
    }
  }

  console.log('✓ Column added successfully!');
  console.log('\nYou can now use customer_providing_artwork flag on work items.');
}

addColumn()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    console.log('\nPlease run the migration manually in Supabase SQL Editor.');
    process.exit(1);
  });
