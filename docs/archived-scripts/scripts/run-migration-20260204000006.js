const { createClient } = require('@supabase/supabase-js');

async function runMigration() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Running migration: 20260204000006_add_assisted_project_production_cadences.sql');

  // Insert the two new cadences
  const cadences = [
    {
      cadence_key: 'assisted_batched',
      name: 'Batched',
      description: 'In production batch',
      work_item_type: 'assisted_project',
      status: 'batched',
      days_until_event_min: null,
      days_until_event_max: null,
      follow_up_days: 999,
      business_days_only: false,
      priority: 100,
      pauses_follow_up: true
    },
    {
      cadence_key: 'assisted_shipped',
      name: 'Shipped',
      description: 'Order shipped to customer',
      work_item_type: 'assisted_project',
      status: 'shipped',
      days_until_event_min: null,
      days_until_event_max: null,
      follow_up_days: 999,
      business_days_only: false,
      priority: 100,
      pauses_follow_up: true
    }
  ];

  for (const cadence of cadences) {
    console.log(`Inserting cadence: ${cadence.cadence_key}`);
    const { data, error } = await supabase
      .from('follow_up_cadences')
      .insert(cadence)
      .select();

    if (error) {
      if (error.code === '23505') {
        console.log(`  → Cadence already exists, skipping`);
      } else {
        console.error(`  → Error:`, error);
        process.exit(1);
      }
    } else {
      console.log(`  → Successfully inserted`);
    }
  }

  console.log('\nMigration completed successfully!');
}

runMigration();
