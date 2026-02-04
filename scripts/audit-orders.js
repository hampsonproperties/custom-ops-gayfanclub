/**
 * Comprehensive Order Audit
 *
 * Checks for:
 * - Already shipped orders still in active system
 * - Batch/status mismatches
 * - Missing emails
 * - Status inconsistencies
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function comprehensiveAudit() {
  console.log('================================================================================');
  console.log('COMPREHENSIVE ORDER AUDIT');
  console.log('================================================================================\n');

  // Fetch all work items with batch info
  const { data: orders, error } = await supabase
    .from('work_items')
    .select(`
      id,
      customer_name,
      customer_email,
      shopify_order_number,
      status,
      batch_id,
      batches (
        id,
        name,
        status
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    return;
  }

  console.log(`Total orders in system: ${orders.length}\n`);

  // Issue tracking
  const issues = {
    statusMismatch: [],
    missingEmail: [],
    shippedButActive: [],
    batchedButWrongStatus: [],
    emailsToBackfill: []
  };

  // Known shipped orders that shouldn't be active
  const SHIPPED_ORDERS = [
    { name: 'Eric Parker', date: '12/22' },
    { name: 'Lucy Nakashima', date: '12/22' },
    { name: 'LilyRose Uyeda', date: '12/20' },
    { name: 'Levi Smith', date: '12/27' },
    { name: 'Nicholas Grigsby', date: '12/29' }
  ];

  // Audit each order
  for (const order of orders) {
    const orderInfo = `${order.customer_name} (Order #${order.shopify_order_number})`;

    // Check 1: Already shipped orders still in system
    const isShipped = SHIPPED_ORDERS.find(s => s.name === order.customer_name);
    if (isShipped) {
      issues.shippedButActive.push({
        ...order,
        shippedDate: isShipped.date,
        issue: `Order shipped ${isShipped.date} but still in system with status: ${order.status}`
      });
    }

    // Check 2: Batched orders with wrong status
    if (order.batch_id && order.batches) {
      if (order.status !== 'batched') {
        issues.batchedButWrongStatus.push({
          ...order,
          issue: `In batch "${order.batches.name}" but status is "${order.status}" instead of "batched"`
        });
      }
    }

    // Check 3: Missing emails
    if (!order.customer_email || order.customer_email.trim() === '') {
      issues.missingEmail.push({
        ...order,
        issue: 'Missing customer email'
      });
    }

    // Check 4: Status without batch (should these be batched?)
    if (order.status === 'batched' && !order.batch_id) {
      issues.statusMismatch.push({
        ...order,
        issue: 'Status is "batched" but no batch_id assigned'
      });
    }
  }

  // Print findings
  console.log('================================================================================');
  console.log('AUDIT FINDINGS');
  console.log('================================================================================\n');

  if (issues.shippedButActive.length > 0) {
    console.log('🚨 SHIPPED ORDERS STILL IN SYSTEM:');
    console.log('─'.repeat(80));
    issues.shippedButActive.forEach(order => {
      console.log(`  • ${order.customer_name} - Order #${order.shopify_order_number}`);
      console.log(`    Shipped: ${order.shippedDate} | Current Status: ${order.status}`);
      if (order.batch_id) console.log(`    In Batch: ${order.batches?.batch_name}`);
      console.log();
    });
  }

  if (issues.batchedButWrongStatus.length > 0) {
    console.log('⚠️  BATCH/STATUS MISMATCHES:');
    console.log('─'.repeat(80));
    issues.batchedButWrongStatus.forEach(order => {
      console.log(`  • ${order.customer_name} - Order #${order.shopify_order_number}`);
      console.log(`    Status: ${order.status} | Should be: batched`);
      console.log(`    Batch: ${order.batches?.batch_name}`);
      console.log();
    });
  }

  if (issues.missingEmail.length > 0) {
    console.log('📧 MISSING EMAILS:');
    console.log('─'.repeat(80));
    issues.missingEmail.forEach(order => {
      console.log(`  • ${order.customer_name} - Order #${order.shopify_order_number}`);
      console.log(`    Status: ${order.status}`);
      console.log();
    });
  }

  if (issues.statusMismatch.length > 0) {
    console.log('🔄 STATUS MISMATCHES:');
    console.log('─'.repeat(80));
    issues.statusMismatch.forEach(order => {
      console.log(`  • ${order.issue}`);
      console.log(`    ${order.customer_name} - Order #${order.shopify_order_number}`);
      console.log();
    });
  }

  // Summary
  console.log('================================================================================');
  console.log('SUMMARY');
  console.log('================================================================================');
  const totalIssues =
    issues.shippedButActive.length +
    issues.batchedButWrongStatus.length +
    issues.missingEmail.length +
    issues.statusMismatch.length;

  console.log(`Total Issues Found: ${totalIssues}`);
  console.log(`  • Shipped orders still active: ${issues.shippedButActive.length}`);
  console.log(`  • Batch/status mismatches: ${issues.batchedButWrongStatus.length}`);
  console.log(`  • Missing emails: ${issues.missingEmail.length}`);
  console.log(`  • Status mismatches: ${issues.statusMismatch.length}`);
  console.log();

  return issues;
}

comprehensiveAudit()
  .then(issues => {
    console.log('Audit complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  });
