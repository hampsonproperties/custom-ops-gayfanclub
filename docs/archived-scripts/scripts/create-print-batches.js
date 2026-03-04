/**
 * Create Print Batches
 *
 * This script creates batches from the print batch data and assigns orders to them.
 * Groups orders by send-to-print date and adds tracking numbers where available.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Batch groups based on send-to-print dates from CSV
const BATCH_GROUPS = [
  {
    name: 'Print Batch - December 2025',
    date: '2025-12-27',
    orders: [
      { customer: 'Gaybor District', qty: 100 },
      { customer: 'Emily Young', qty: 1 }
    ]
  },
  {
    name: 'Print Batch - Early January 2026',
    date: '2026-01-14',
    trackingNumber: '288436819501020813', // Claude Agenor's Alibaba order
    orders: [
      { customer: 'Ryan A Arbeiter', qty: 1 }, // 1/1
      { customer: 'Kayla Cowin', qty: 1 }, // 1/4 - has tracking 288834098501020813
      { customer: 'Madison Villamaino', qty: 1 }, // 1/9 (3 soldiers)
      { customer: 'Mellissa Giegerich', qty: 1 }, // 1/11
      { customer: 'Rod Santos', qty: 26 }, // 1/13 RICHMOND
      { customer: 'CLaude Agenor', qty: 2 }, // 1/14
      { customer: 'Brett Young', qty: 10 } // 1/14
    ]
  },
  {
    name: 'Print Batch - Mid January 2026',
    date: '2026-01-19',
    trackingNumber: '290055146001020813', // Shared by Melissa Billy and Canelius Turner
    orders: [
      { customer: 'Melissa Billy', qty: 2 }, // 1/16
      { customer: 'Kandice Hart', qty: 1 }, // 1/17 - has tracking 289385298501020813
      { customer: 'Sofia Flores', qty: 1 }, // 1/16
      { customer: 'Canelius Turner', qty: 1 } // 1/19
    ]
  },
  {
    name: 'Print Batch - Late January 2026',
    date: '2026-01-24',
    trackingNumber: '290402442001020813', // Victoria Escapil
    orders: [
      { customer: 'Trish Gaeta', qty: 4 }, // 1/22 (Patricia Gaeta)
      { customer: 'Victoria Escapil', qty: 10 }, // 1/22
      { customer: 'Andy Frye', qty: 20 } // 1/24
    ]
  },
  {
    name: 'Print Batch - February 2026',
    date: '2026-02-01',
    trackingNumber: '290556715001020813', // Jasmine Foye
    orders: [
      { customer: 'Shelby LaFreniere', qty: 1 },
      { customer: 'Jasmine Foye', qty: 1 },
      { customer: 'Basil Zurcher', qty: 25 },
      { customer: 'Nia Holloway', qty: 1 },
      { customer: 'YOLANDA JONES', qty: 230 },
      { customer: 'Aryll Salazar', qty: 1 }
    ]
  }
];

async function findWorkItem(customerName, quantity) {
  // Try to find by exact customer name and quantity
  const { data, error } = await supabase
    .from('work_items')
    .select('id, customer_name, quantity, shopify_order_number')
    .ilike('customer_name', `%${customerName}%`)
    .eq('status', 'batched')
    .is('batch_id', null); // Not already in a batch

  if (error) {
    console.error(`Error finding work item for ${customerName}:`, error.message);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  // If multiple matches, try to match by quantity
  if (data.length > 1) {
    const match = data.find(w => w.quantity === quantity);
    return match || data[0];
  }

  return data[0];
}

async function createBatchWithOrders() {
  console.log('='.repeat(80));
  console.log('CREATING PRINT BATCHES');
  console.log('='.repeat(80));
  console.log();

  let totalBatches = 0;
  let totalOrders = 0;
  let notFoundOrders = [];

  for (const batchGroup of BATCH_GROUPS) {
    console.log(`Creating: ${batchGroup.name}...`);

    // Create batch
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .insert({
        name: batchGroup.name,
        status: 'confirmed',
        confirmed_at: batchGroup.date,
        tracking_number: batchGroup.trackingNumber || null,
        shipped_at: batchGroup.trackingNumber ? batchGroup.date : null,
        notes: batchGroup.trackingNumber
          ? `Alibaba Order: ${batchGroup.trackingNumber}`
          : 'Print batch from CSV migration'
      })
      .select()
      .single();

    if (batchError) {
      console.error(`  ✗ Error creating batch: ${batchError.message}`);
      continue;
    }

    console.log(`  ✓ Created batch: ${batch.id}`);
    if (batchGroup.trackingNumber) {
      console.log(`  ✓ Tracking: ${batchGroup.trackingNumber}`);
    }
    totalBatches++;

    // Add orders to batch
    let addedToThisBatch = 0;
    for (const orderInfo of batchGroup.orders) {
      const workItem = await findWorkItem(orderInfo.customer, orderInfo.qty);

      if (!workItem) {
        console.log(`  ⚠️  Could not find: ${orderInfo.customer} (${orderInfo.qty} units)`);
        notFoundOrders.push({ ...orderInfo, batchName: batchGroup.name });
        continue;
      }

      // Add to batch_items
      const { error: batchItemError } = await supabase
        .from('batch_items')
        .insert({
          batch_id: batch.id,
          work_item_id: workItem.id,
          position: addedToThisBatch + 1
        });

      if (batchItemError) {
        console.log(`  ✗ Error adding ${orderInfo.customer}: ${batchItemError.message}`);
        continue;
      }

      // Update work_item.batch_id
      await supabase
        .from('work_items')
        .update({ batch_id: batch.id })
        .eq('id', workItem.id);

      console.log(`  ✓ Added: ${orderInfo.customer} - Order ${workItem.shopify_order_number || 'N/A'}`);
      addedToThisBatch++;
      totalOrders++;
    }

    console.log(`  Summary: ${addedToThisBatch}/${batchGroup.orders.length} orders added`);
    console.log();
  }

  console.log('='.repeat(80));
  console.log('BATCH CREATION COMPLETE');
  console.log('='.repeat(80));
  console.log(`\n✅ Created: ${totalBatches} batches`);
  console.log(`✅ Assigned: ${totalOrders} orders to batches`);

  if (notFoundOrders.length > 0) {
    console.log(`\n⚠️  ${notFoundOrders.length} orders not found:`);
    notFoundOrders.forEach(order => {
      console.log(`  - ${order.customer} (${order.qty} units) for ${order.batchName}`);
    });
    console.log('\nThese might be:');
    console.log('  1. Not yet imported into the system');
    console.log('  2. Already assigned to a different batch');
    console.log('  3. Have a different status than "batched"');
  }

  console.log('\n✅ Batches are now visible at: /batches');
}

createBatchWithOrders().catch(console.error);
