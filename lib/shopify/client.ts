/**
 * Shopify API Client
 * Handles authentication and session creation for Shopify API calls
 */

import '@shopify/shopify-api/adapters/node'
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api'

/**
 * Validates that all required Shopify environment variables are present
 * Throws an error if any are missing
 */
function validateShopifyEnv() {
  const requiredEnvVars = {
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_SHOP_DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
  } as const

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Shopify environment variables: ${missingVars.join(', ')}. ` +
      `Please configure these in your .env.local file.`
    )
  }

  return {
    apiKey: process.env.SHOPIFY_API_KEY!,
    apiSecret: process.env.SHOPIFY_API_SECRET!,
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN!,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN!,
  }
}

/**
 * Get Shopify API client instance
 * Lazy initialization - validates env vars only when called
 */
let shopifyInstance: ReturnType<typeof shopifyApi> | null = null

export function getShopifyClient() {
  if (!shopifyInstance) {
    const env = validateShopifyEnv()

    shopifyInstance = shopifyApi({
      apiKey: env.apiKey,
      apiSecretKey: env.apiSecret,
      scopes: ['read_orders', 'read_customers'],
      hostName: env.shopDomain.replace('https://', '').replace('http://', ''),
      apiVersion: ApiVersion.January26,
      isEmbeddedApp: false,
    })
  }

  return shopifyInstance
}

/**
 * Creates a Shopify session for API calls
 * Uses custom app session (no OAuth flow needed)
 * Validates environment variables at runtime
 */
export const createShopifySession = (): Session => {
  const env = validateShopifyEnv()
  const shop = env.shopDomain.replace('https://', '').replace('http://', '')

  return new Session({
    id: `offline_${shop}`,
    shop,
    state: 'offline',
    isOnline: false,
    accessToken: env.accessToken,
  })
}

// Default export for backwards compatibility
export default { getShopifyClient, createShopifySession }
