/**
 * Migration Script: Print Batch Orders
 *
 * This script:
 * 1. Imports 8 "SENT TO PRINT" orders from Shopify
 * 2. Updates status of 10 existing orders to "batched"
 */

const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing environment variables. Make sure .env.local is loaded.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 8 orders to import from Shopify
const ORDERS_TO_IMPORT = [
  { shopifyOrderId: '8488592703794', orderNumber: '#6490', customer: 'Rod Santos', project: 'RICHMOND' },
  { shopifyOrderId: '8378444775730', orderNumber: '#6373', customer: 'Emily Young', project: 'Badness' },
  { shopifyOrderId: '8493220561202', orderNumber: '#6503', customer: 'Melissa Billy', project: 'MLK' },
  { shopifyOrderId: '8495030894898', orderNumber: '#6506', customer: 'Kandice Hart', project: 'Blue fan' },
  { shopifyOrderId: '8492881871154', orderNumber: '#6501', customer: 'Sofia Flores', project: 'Can I get a bump' },
  { shopifyOrderId: '8496249307442', orderNumber: '#6511', customer: 'Canelius Turner', project: 'Creme Cunt' },
  { shopifyOrderId: '8500949975346', orderNumber: '#6518', customer: 'Trish Gaeta', project: 'Custom Numbers' },
  { shopifyOrderId: '8502551511346', orderNumber: '#6520', customer: 'Victoria Escapil', project: 'Conceptions Florida' }
];

// 10 orders that need status update to "batched"
const ORDERS_TO_UPDATE = [
  { id: '0a71d4fb-4d60-4f6f-9b76-5ac473d7db44', customer: 'Mellissa Giegerich', project: 'Cats' },
  { id: 'c0cd27cc-aa4f-4351-b4b3-501c362d7fe1', customer: 'CLaude Agenor', project: 'Buss ass whine' },
  { id: '7fa57f16-48ac-4212-a22a-ba22b040eb2b', customer: 'Brett Young', project: 'Good for Her' },
  { id: 'c995f14a-2d38-4c51-a44e-4573cbf29260', customer: 'Shelby LaFreniere', project: 'Fuck Ice' },
  { id: 'c90b6c48-8836-4184-8e4d-5b108447c865', customer: 'Jasmine Foye', project: 'Dawgs' },
  { id: 'c0ae0c91-73c4-4d5c-9ef2-52cb86bede5e', customer: 'Basil Zurcher', project: 'SHIP DIRECT TO SWITZERLAND' },
  { id: '5e114519-f4e5-4ca2-902c-c86ae2b764ff', customer: 'Nia Holloway', project: 'Happily Ever After Green' },
  { id: '282b27c0-07fa-416f-ad07-845400349a51', customer: 'Gaybor District', project: 'Gaybor' },
  { id: '25b28db7-bd73-4cba-9cdf-1d2577ea4967', customer: 'Kayla Cowin', project: 'Luck I Me!' },
  { id: '3c21365b-4757-415a-b610-beaf43fe1711', customer: 'Madison Villamaino', project: '3 Soldiers' }
];

async function getShopifyCredentials() {
  const { data, error } = await supabase
    .from('shopify_credentials')
    .select('shop, access_token')
    .eq('shop', 'houston-fan-club.myshopify.com')
    .single();

  if (error || !data) {
    throw new Error('Shopify credentials not found');
  }

  return data;
}

async function fetchShopifyOrder(accessToken, shop, orderId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: shop,
      path: `/admin/api/2024-01/orders/${orderId}.json`,
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data).order);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function detectOrderType(order) {
  // Simplified version of detect-order-type logic
  const lineItems = order.line_items || [];

  for (const item of lineItems) {
    const title = (item.title || '').toLowerCase();

    // Check for Customify
    if (title.includes('customify')) {
      return 'customify_order';
    }

    // Check for custom design service
    if (title.includes('professional custom fan design service')) {
      return 'custom_design_service';
    }

    // Check for bulk/custom
    if (title.includes('custom') || title.includes('bulk')) {
      return 'assisted_project';
    }
  }

  return null;
}

async function importOrder(shopifyOrder, shopifyCredentials) {
  const orderType = detectOrderType(shopifyOrder);

  if (!orderType) {
    console.log(`    ⚠️  Order is not a custom order, skipping`);
    return null;
  }

  // Extract customer info
  const customer = shopifyOrder.customer || {};
  const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  const customerEmail = customer.email;

  // Extract quantity
  const quantity = shopifyOrder.line_items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Extract grip color and design preview from line item properties
  let gripColor = null;
  let designPreviewUrl = null;

  for (const item of shopifyOrder.line_items || []) {
    if (item.properties && Array.isArray(item.properties)) {
      for (const prop of item.properties) {
        if (prop.name === 'Grip Color' || prop.name === 'grip_color') {
          gripColor = prop.value;
        }
        if (prop.name === 'design_preview' || prop.name === '_design_preview_url' || prop.name === 'Preview') {
          designPreviewUrl = prop.value;
        }
      }
    }
  }

  // Create customer record if needed
  let customerId = null;
  if (customerEmail) {
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('email', customerEmail)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          email: customerEmail,
          first_name: customer.first_name,
          last_name: customer.last_name,
          phone: customer.phone,
          shopify_customer_id: customer.id?.toString()
        })
        .select()
        .single();

      if (!customerError && newCustomer) {
        customerId = newCustomer.id;
      }
    }
  }

  // Determine initial status based on order type
  let initialStatus = 'batched'; // Since these are "SENT TO PRINT" orders

  if (orderType === 'customify_order') {
    initialStatus = 'batched';
  } else if (orderType === 'assisted_project') {
    initialStatus = 'batched';
  }

  // Create work item
  const workItemData = {
    type: orderType,
    source: 'shopify',
    customer_id: customerId,
    customer_name: customerName || null,
    customer_email: customerEmail || null,
    shopify_order_id: shopifyOrder.id.toString(),
    shopify_order_number: shopifyOrder.name,
    shopify_financial_status: shopifyOrder.financial_status,
    shopify_fulfillment_status: shopifyOrder.fulfillment_status,
    status: initialStatus,
    quantity: quantity || null,
    grip_color: gripColor,
    design_preview_url: designPreviewUrl,
    batched_at: new Date().toISOString(), // Mark as batched since it was "SENT TO PRINT"
    created_at: shopifyOrder.created_at
  };

  const { data: workItem, error: workItemError } = await supabase
    .from('work_items')
    .insert(workItemData)
    .select()
    .single();

  if (workItemError) {
    throw workItemError;
  }

  return workItem;
}

async function updateOrderStatus(orderId, customerName) {
  const { error } = await supabase
    .from('work_items')
    .update({
      status: 'batched',
      batched_at: new Date().toISOString()
    })
    .eq('id', orderId);

  if (error) {
    throw error;
  }

  console.log(`  ✓ Updated ${customerName} to "batched"`);
}

async function migrate() {
  console.log('='.repeat(80));
  console.log('PRINT BATCH MIGRATION');
  console.log('='.repeat(80));
  console.log();

  try {
    // Get Shopify credentials
    const shopifyCredentials = await getShopifyCredentials();
    console.log(`Connected to Shopify: ${shopifyCredentials.shop}\n`);

    // PART 1: Import 8 Shopify orders
    console.log('='.repeat(80));
    console.log('PART 1: IMPORTING 8 SHOPIFY ORDERS');
    console.log('='.repeat(80));
    console.log();

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const orderInfo of ORDERS_TO_IMPORT) {
      try {
        console.log(`Importing ${orderInfo.customer} - ${orderInfo.orderNumber} (${orderInfo.project})...`);

        // Fetch full order from Shopify
        const shopifyOrder = await fetchShopifyOrder(
          shopifyCredentials.access_token,
          shopifyCredentials.shop,
          orderInfo.shopifyOrderId
        );

        // Import into database
        const workItem = await importOrder(shopifyOrder, shopifyCredentials);

        if (workItem) {
          console.log(`  ✓ Imported as work item: ${workItem.id}`);
          console.log(`  ✓ Status: ${workItem.status}`);
          importedCount++;
        } else {
          skippedCount++;
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
        errorCount++;
      }
      console.log();
    }

    console.log(`Import Summary: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors\n`);

    // PART 2: Update status of 10 existing orders
    console.log('='.repeat(80));
    console.log('PART 2: UPDATING STATUS OF 10 EXISTING ORDERS');
    console.log('='.repeat(80));
    console.log();

    let updatedCount = 0;
    let updateErrorCount = 0;

    for (const orderInfo of ORDERS_TO_UPDATE) {
      try {
        await updateOrderStatus(orderInfo.id, orderInfo.customer);
        updatedCount++;
      } catch (error) {
        console.error(`  ✗ Error updating ${orderInfo.customer}: ${error.message}`);
        updateErrorCount++;
      }
    }

    console.log();
    console.log(`Update Summary: ${updatedCount} updated, ${updateErrorCount} errors\n`);

    // FINAL SUMMARY
    console.log('='.repeat(80));
    console.log('MIGRATION COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n✅ Imported: ${importedCount} orders`);
    console.log(`✅ Updated: ${updatedCount} statuses`);
    console.log(`⚠️  Errors: ${errorCount + updateErrorCount} total`);
    console.log();

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrate();
