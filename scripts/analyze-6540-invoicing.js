/**
 * Analyze Order #6540 Invoicing Method
 *
 * Checks if this is a single order with partial payment
 * or multiple separate orders
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeInvoicing() {
  console.log('================================================================================');
  console.log('ANALYZING ORDER #6540 INVOICING METHOD');
  console.log('================================================================================\n');

  // Get Shopify credentials
  const { data: creds } = await supabase
    .from('shopify_credentials')
    .select('shop, access_token')
    .single();

  if (!creds) {
    console.log('No Shopify credentials found');
    return;
  }

  // Fetch the order from Shopify
  const response = await fetch(
    `https://${creds.shop}/admin/api/2024-01/orders/8511409750322.json`,
    {
      headers: {
        'X-Shopify-Access-Token': creds.access_token,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    console.log('Failed to fetch order from Shopify');
    return;
  }

  const { order } = await response.json();

  console.log('ORDER DETAILS FROM SHOPIFY:');
  console.log('─'.repeat(80));
  console.log(`Order Number: #${order.order_number}`);
  console.log(`Customer: ${order.customer?.first_name} ${order.customer?.last_name}`);
  console.log();
  console.log('FINANCIAL DETAILS:');
  console.log(`  Total Price: $${order.total_price}`);
  console.log(`  Subtotal: $${order.subtotal_price}`);
  console.log(`  Total Outstanding: $${order.total_outstanding || '0.00'}`);
  console.log(`  Financial Status: ${order.financial_status}`);
  console.log();

  if (order.transactions && order.transactions.length > 0) {
    console.log('PAYMENT TRANSACTIONS:');
    console.log('─'.repeat(80));
    let totalPaid = 0;
    order.transactions.forEach((t, i) => {
      if (t.kind === 'sale' && t.status === 'success') {
        totalPaid += parseFloat(t.amount);
        console.log(`  ${i + 1}. ${t.kind} - ${t.status}`);
        console.log(`     Amount: $${t.amount} ${t.currency}`);
        console.log(`     Date: ${t.created_at}`);
        console.log(`     Gateway: ${t.gateway}`);
        console.log();
      }
    });
    console.log(`  Total Paid: $${totalPaid.toFixed(2)}`);
    console.log();
  }

  console.log('================================================================================');
  console.log('ANALYSIS');
  console.log('================================================================================\n');

  const totalPrice = parseFloat(order.total_price);
  const totalOutstanding = parseFloat(order.total_outstanding || '0');
  const amountPaid = totalPrice - totalOutstanding;

  console.log(`Original Order Total: $${totalPrice.toFixed(2)}`);
  console.log(`Amount Paid So Far: $${amountPaid.toFixed(2)}`);
  console.log(`Still Outstanding: $${totalOutstanding.toFixed(2)}`);
  console.log();

  if (totalOutstanding === 0 && order.financial_status === 'paid') {
    console.log('⚠️  SCENARIO B: Separate Invoice');
    console.log('─'.repeat(80));
    console.log('This appears to be a SEPARATE invoice for just the deposit.');
    console.log();
    console.log('The order total ($' + totalPrice + ') is fully paid,');
    console.log('but this is only the 50% deposit invoice.');
    console.log();
    console.log('PROBLEM: When you create a second invoice for the final 50%,');
    console.log('it will also show as "paid" and the webhook can\'t tell them apart.');
    console.log();
    console.log('SOLUTION: Use ONE Shopify order with partial payments instead.');
  } else if (totalOutstanding > 0) {
    console.log('✅ SCENARIO A: Single Order with Partial Payment');
    console.log('─'.repeat(80));
    console.log('This is ONE order with partial payment - PERFECT!');
    console.log();
    console.log('Webhooks will work automatically:');
    console.log('  - When customer pays more → status updates automatically');
    console.log('  - When fully paid → status changes to "paid_ready_for_batch"');
    console.log();
    console.log('This is the correct approach!');
  } else {
    console.log('Unable to determine invoicing method');
  }

  console.log();
}

analyzeInvoicing()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
