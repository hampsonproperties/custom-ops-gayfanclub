/**
 * Shopify API Client
 * Handles authentication and session creation for Shopify API calls
 * Uses existing shopify_credentials table for access tokens
 */

import '@shopify/shopify-api/adapters/node'
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api'
import { getShopifyCredentials } from './get-credentials'

/**
 * Validates that all required Shopify environment variables are present
 */
function validateShopifyEnv() {
  const requiredEnvVars = {
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
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
    shopDomain: process.env.SHOPIFY_STORE_DOMAIN!,
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
 * Fetches access token from shopify_credentials table
 */
export const createShopifySession = async (): Promise<Session> => {
  const env = validateShopifyEnv()

  // Get access token from database
  const credentials = await getShopifyCredentials()
  const shop = env.shopDomain.replace('https://', '').replace('http://', '')

  return new Session({
    id: `offline_${shop}`,
    shop,
    state: 'offline',
    isOnline: false,
    accessToken: credentials.accessToken,
  })
}

// Default export for backwards compatibility
export default { getShopifyClient, createShopifySession }
