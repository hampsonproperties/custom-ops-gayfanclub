/**
 * Inspect Shopify Credentials Table Structure
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
  console.log('Fetching shopify_credentials record to see structure...\n');

  const { data, error } = await supabase
    .from('shopify_credentials')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Record structure (all columns):');
  console.log(JSON.stringify(data, null, 2));
}

inspectTable()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
