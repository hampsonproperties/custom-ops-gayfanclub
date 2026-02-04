/**
 * Re-import Order #6540 from Shopify
 *
 * Fetches current order data from Shopify and updates the work item
 * This will sync the current payment status
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getShopifyCredentials() {
  const { data, error } = await supabase
    .from('shopify_credentials')
    .select('shop, access_token')
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error('No Shopify credentials found');
  }

  if (!data.shop || !data.access_token) {
    throw new Error('Incomplete Shopify credentials');
  }

  return {
    shop: data.shop,
    accessToken: data.access_token
  };
}

async function reimportOrder() {
  console.log('================================================================================');
  console.log('RE-IMPORT ORDER #6540 FROM SHOPIFY');
  console.log('================================================================================\n');

  // Get the current work item
  const { data: workItem, error: workItemError } = await supabase
    .from('work_items')
    .select('id, shopify_order_id, shopify_order_number, shopify_financial_status, status, customer_name')
    .eq('shopify_order_number', '#6540')
    .single();

  if (workItemError || !workItem) {
    console.error('Error finding work item:', workItemError);
    return;
  }

  console.log('Current Work Item:');
  console.log(`  Customer: ${workItem.customer_name}`);
  console.log(`  Order: ${workItem.shopify_order_number}`);
  console.log(`  Shopify Order ID: ${workItem.shopify_order_id}`);
  console.log(`  Current Financial Status: ${workItem.shopify_financial_status}`);
  console.log(`  Current Status: ${workItem.status}`);
  console.log();

  // Get Shopify credentials
  console.log('Fetching Shopify credentials...');
  let credentials;
  try {
    credentials = await getShopifyCredentials();
    console.log(`✓ Connected to shop: ${credentials.shop}`);
    console.log();
  } catch (err) {
    console.error('✗ Failed to get Shopify credentials:', err.message);
    console.log('\nMake sure you have Shopify credentials configured in the database.');
    return;
  }

  // Fetch order from Shopify
  console.log('Fetching order from Shopify API...');
  const shopifyUrl = `https://${credentials.shop}/admin/api/2024-01/orders/${workItem.shopify_order_id}.json`;

  let order;
  try {
    const response = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': credentials.accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    order = data.order;
    console.log('✓ Order fetched successfully');
    console.log();
  } catch (err) {
    console.error('✗ Failed to fetch from Shopify:', err.message);
    return;
  }

  // Display current Shopify data
  console.log('================================================================================');
  console.log('CURRENT DATA IN SHOPIFY');
  console.log('================================================================================\n');
  console.log(`Order Number: ${order.order_number}`);
  console.log(`Financial Status: ${order.financial_status}`);
  console.log(`Fulfillment Status: ${order.fulfillment_status || 'null'}`);
  console.log(`Total Price: ${order.total_price} ${order.currency}`);
  console.log(`Total Outstanding: ${order.total_outstanding || '0'}`);
  console.log(`Created: ${order.created_at}`);
  console.log(`Updated: ${order.updated_at}`);
  console.log();

  if (order.transactions && order.transactions.length > 0) {
    console.log(`Payment Transactions (${order.transactions.length}):`);
    order.transactions.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.kind} - ${t.status} - ${t.amount} ${t.currency} (${t.gateway})`);
    });
    console.log();
  }

  // Determine new status based on payment
  let newStatus = workItem.status;
  if (order.financial_status === 'paid') {
    newStatus = 'paid_ready_for_batch';
  } else if (order.financial_status === 'partially_paid') {
    newStatus = 'deposit_paid_ready_for_batch';
  } else if (order.financial_status === 'pending') {
    newStatus = 'invoice_sent';
  }

  console.log('================================================================================');
  console.log('PROPOSED UPDATES');
  console.log('================================================================================\n');
  console.log(`shopify_financial_status: "${workItem.shopify_financial_status}" → "${order.financial_status}"`);
  console.log(`shopify_fulfillment_status: "${workItem.shopify_fulfillment_status || 'null'}" → "${order.fulfillment_status || 'null'}"`);
  console.log(`status: "${workItem.status}" → "${newStatus}"`);
  console.log();

  // Update the work item
  console.log('Updating work item...');
  const { error: updateError } = await supabase
    .from('work_items')
    .update({
      shopify_financial_status: order.financial_status,
      shopify_fulfillment_status: order.fulfillment_status,
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', workItem.id);

  if (updateError) {
    console.error('✗ Failed to update work item:', updateError.message);
    return;
  }

  console.log('✓ Work item updated successfully');

  // Create status event if status changed
  if (workItem.status !== newStatus) {
    let noteText = '';
    if (order.financial_status === 'paid') {
      noteText = 'Order fully paid (synced from Shopify)';
    } else if (order.financial_status === 'partially_paid') {
      noteText = 'Partial payment received (synced from Shopify)';
    } else {
      noteText = `Payment status updated to ${order.financial_status} (synced from Shopify)`;
    }

    await supabase.from('work_item_status_events').insert({
      work_item_id: workItem.id,
      from_status: workItem.status,
      to_status: newStatus,
      changed_by_user_id: null,
      note: noteText,
    });

    console.log('✓ Status event logged');
  }

  console.log();
  console.log('================================================================================');
  console.log('SUCCESS!');
  console.log('================================================================================');
  console.log(`Order #6540 has been synced with current Shopify data.`);
  console.log();
}

reimportOrder()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
