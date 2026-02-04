/**
 * Check Webhook Events for Order #6540
 *
 * See if Shopify sent any webhooks for this order
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkWebhookEvents() {
  console.log('================================================================================');
  console.log('WEBHOOK EVENTS CHECK: ORDER #6540');
  console.log('================================================================================\n');

  // Get the order
  const { data: order, error: orderError } = await supabase
    .from('work_items')
    .select('id, shopify_order_id, shopify_order_number, shopify_financial_status, status')
    .eq('shopify_order_number', '#6540')
    .single();

  if (orderError || !order) {
    console.error('Error fetching order:', orderError);
    return;
  }

  console.log('Order Details:');
  console.log(`  Shopify Order ID: ${order.shopify_order_id}`);
  console.log(`  Order Number: ${order.shopify_order_number}`);
  console.log(`  Financial Status: ${order.shopify_financial_status}`);
  console.log(`  Work Item Status: ${order.status}`);
  console.log();

  // Check for webhook events related to this order
  const { data: webhooks, error: webhookError } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('provider', 'shopify')
    .eq('external_event_id', order.shopify_order_id)
    .order('created_at', { ascending: false });

  if (webhookError) {
    console.error('Error fetching webhooks:', webhookError);
    return;
  }

  console.log('================================================================================');
  console.log('WEBHOOK EVENTS');
  console.log('================================================================================\n');

  if (!webhooks || webhooks.length === 0) {
    console.log('⚠️  No webhook events found for this order!');
    console.log();
    console.log('This means either:');
    console.log('  1. Shopify webhooks are not configured');
    console.log('  2. The webhook for this order update has not been sent yet');
    console.log('  3. The webhook failed to be logged');
    console.log();
    console.log('Current Status in Your DB:');
    console.log(`  shopify_financial_status: "${order.shopify_financial_status}"`);
    console.log(`  status: "${order.status}"`);
    console.log();
    console.log('If partial payment was made in Shopify, you need to either:');
    console.log('  A. Wait for the webhook to arrive (if configured)');
    console.log('  B. Manually trigger a re-import of this order');
    console.log('  C. Manually update the status');
    return;
  }

  console.log(`Found ${webhooks.length} webhook event(s):\n`);

  webhooks.forEach((webhook, index) => {
    console.log(`Webhook ${index + 1}:`);
    console.log(`  Event Type: ${webhook.event_type}`);
    console.log(`  Processing Status: ${webhook.processing_status}`);
    console.log(`  Created: ${webhook.created_at}`);
    console.log(`  Processed: ${webhook.processed_at || 'Not yet processed'}`);
    if (webhook.processing_error) {
      console.log(`  Error: ${webhook.processing_error}`);
    }
    console.log(`  Payload Financial Status: ${webhook.payload?.financial_status || 'N/A'}`);
    console.log();
  });
}

checkWebhookEvents()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
