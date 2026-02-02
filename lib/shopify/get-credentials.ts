import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function getShopifyCredentials() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const shop = process.env.SHOPIFY_STORE_DOMAIN!

  const { data, error } = await supabase
    .from('shopify_credentials')
    .select('shop, access_token, scope')
    .eq('shop', shop)
    .single()

  if (error || !data) {
    throw new Error('Shopify credentials not found. Please connect your Shopify store first.')
  }

  return {
    shop: data.shop,
    accessToken: data.access_token,
    scope: data.scope,
  }
}
