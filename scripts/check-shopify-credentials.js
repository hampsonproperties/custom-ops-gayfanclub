/**
 * Check Shopify Credentials in Database
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCredentials() {
  console.log('Checking shopify_credentials table...\n');

  const { data, error } = await supabase
    .from('shopify_credentials')
    .select('*');

  if (error) {
    console.error('Error querying table:', error);
    console.log('\nThe shopify_credentials table might not exist or has different structure.');
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ No credentials found in database!');
    console.log('\nYou need to complete the Shopify OAuth flow to store credentials.');
    console.log('Or manually insert them into the shopify_credentials table.');
    return;
  }

  console.log(`✅ Found ${data.length} credential record(s):\n`);
  data.forEach((cred, i) => {
    console.log(`Record ${i + 1}:`);
    console.log(`  Shop Domain: ${cred.shop_domain || 'N/A'}`);
    console.log(`  Has Access Token: ${cred.access_token ? 'Yes (' + cred.access_token.substring(0, 20) + '...)' : 'No'}`);
    console.log(`  Created: ${cred.created_at || 'N/A'}`);
    console.log();
  });
}

checkCredentials()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
