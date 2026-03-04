/**
 * Fix Shopify Credentials - Add Shop Domain
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// From your .env.local
const SHOP_DOMAIN = 'houston-fan-club.myshopify.com';

async function fixCredentials() {
  console.log('Updating shopify_credentials with shop domain...\n');

  // Get the current record
  const { data: current, error: fetchError } = await supabase
    .from('shopify_credentials')
    .select('*')
    .limit(1)
    .single();

  if (fetchError) {
    console.error('Error fetching credentials:', fetchError);
    return;
  }

  console.log('Current record:');
  console.log(`  Shop Domain: ${current.shop_domain || 'NULL'}`);
  console.log(`  Has Access Token: ${current.access_token ? 'Yes' : 'No'}`);
  console.log();

  // Update with shop domain
  const { error: updateError } = await supabase
    .from('shopify_credentials')
    .update({ shop_domain: SHOP_DOMAIN })
    .eq('id', current.id);

  if (updateError) {
    console.error('✗ Failed to update:', updateError);
    return;
  }

  console.log('✓ Updated successfully!');
  console.log(`  New Shop Domain: ${SHOP_DOMAIN}`);
  console.log();

  // Verify
  const { data: updated, error: verifyError } = await supabase
    .from('shopify_credentials')
    .select('shop_domain, access_token')
    .limit(1)
    .single();

  if (!verifyError && updated) {
    console.log('Verified:');
    console.log(`  Shop Domain: ${updated.shop_domain}`);
    console.log(`  Has Access Token: ${updated.access_token ? 'Yes' : 'No'}`);
    console.log();
    console.log('✓ Shopify credentials are now complete!');
  }
}

fixCredentials()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
