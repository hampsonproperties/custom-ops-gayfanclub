/**
 * Check Shopify Data for Order #6540
 *
 * Pull all available Shopify data to see payment/financial details
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Check if we can fetch from Shopify API
async function fetchFromShopify(orderId) {
  console.log('Attempting to fetch from Shopify API...\n');

  // Check for Shopify credentials
  const { data: creds, error: credsError } = await supabase
    .from('shopify_credentials')
    .select('*')
    .limit(1)
    .single();

  if (credsError || !creds) {
    console.log('No Shopify credentials found in database');
    return null;
  }

  console.log('Found Shopify credentials');
  console.log(`Shop: ${creds.shop_domain || 'N/A'}`);
  console.log(`Has Access Token: ${creds.access_token ? 'Yes' : 'No'}\n`);

  if (!creds.access_token || !creds.shop_domain) {
    console.log('Missing access token or shop domain');
    return null;
  }

  // Try to fetch order from Shopify
  try {
    const shopifyUrl = `https://${creds.shop_domain}/admin/api/2024-01/orders/${orderId}.json`;

    console.log(`Fetching from Shopify: ${shopifyUrl}\n`);

    const response = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': creds.access_token,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`Shopify API returned: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.order;
  } catch (err) {
    console.error('Error fetching from Shopify:', err.message);
    return null;
  }
}

async function checkShopifyData() {
  console.log('================================================================================');
  console.log('SHOPIFY DATA CHECK: ORDER #6540');
  console.log('================================================================================\n');

  // Get work item
  const { data: item, error } = await supabase
    .from('work_items')
    .select('*')
    .eq('shopify_order_number', '#6540')
    .single();

  if (error) {
    console.error('Error fetching work item:', error);
    return;
  }

  console.log('Work Item Shopify Fields:');
  console.log('─'.repeat(80));
  console.log(`Shopify Order ID: ${item.shopify_order_id}`);
  console.log(`Shopify Order Number: ${item.shopify_order_number}`);
  console.log(`Shopify Financial Status: ${item.shopify_financial_status}`);
  console.log(`Shopify Fulfillment Status: ${item.shopify_fulfillment_status || 'null'}`);
  console.log(`Shopify Draft Order ID: ${item.shopify_draft_order_id || 'null'}`);
  console.log();

  // Try to fetch live data from Shopify
  console.log('================================================================================');
  console.log('ATTEMPTING TO FETCH LIVE SHOPIFY DATA');
  console.log('================================================================================\n');

  const shopifyOrder = await fetchFromShopify(item.shopify_order_id);

  if (shopifyOrder) {
    console.log('SUCCESS! Retrieved order from Shopify:');
    console.log('─'.repeat(80));
    console.log(`Order Number: ${shopifyOrder.order_number}`);
    console.log(`Financial Status: ${shopifyOrder.financial_status}`);
    console.log(`Fulfillment Status: ${shopifyOrder.fulfillment_status || 'null'}`);
    console.log(`Total Price: ${shopifyOrder.total_price} ${shopifyOrder.currency}`);
    console.log(`Total Outstanding: ${shopifyOrder.total_outstanding || '0'}`);
    console.log(`Subtotal: ${shopifyOrder.subtotal_price}`);
    console.log(`Created: ${shopifyOrder.created_at}`);
    console.log(`Updated: ${shopifyOrder.updated_at}`);
    console.log();

    if (shopifyOrder.transactions && shopifyOrder.transactions.length > 0) {
      console.log(`Transactions (${shopifyOrder.transactions.length}):`);
      shopifyOrder.transactions.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.kind} - ${t.status} - ${t.amount} ${t.currency}`);
        console.log(`     Gateway: ${t.gateway}`);
        console.log(`     Created: ${t.created_at}`);
      });
      console.log();
    }

    if (shopifyOrder.payment_terms) {
      console.log('Payment Terms:');
      console.log(JSON.stringify(shopifyOrder.payment_terms, null, 2));
      console.log();
    }

    console.log('\nFull Order Data:');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(shopifyOrder, null, 2));
  } else {
    console.log('Could not fetch live data from Shopify API');
    console.log('Only local work_items data is available (shown above)');
  }
}

checkShopifyData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
