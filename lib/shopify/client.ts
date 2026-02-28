/**
 * Shopify API Client
 * Handles authentication and session creation for Shopify API calls
 */

import '@shopify/shopify-api/adapters/node'
import { shopifyApi, LATEST_API_VERSION, Session } from '@shopify/shopify-api'

// Validate required environment variables at module initialization
const requiredEnvVars = {
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
  SHOPIFY_SHOP_DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN,
  SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN,
} as const

// Check for missing environment variables
const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key)

if (missingVars.length > 0) {
  throw new Error(
    `Missing required Shopify environment variables: ${missingVars.join(', ')}. ` +
    `Please configure these in your .env.local file.`
  )
}

// Safe to use non-null assertions now that we've validated
const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY!
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET!
const SHOPIFY_SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN!
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN!

// Initialize Shopify API client
const shopify = shopifyApi({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes: ['read_orders', 'read_customers'],
  hostName: SHOPIFY_SHOP_DOMAIN.replace('https://', '').replace('http://', ''),
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
})

/**
 * Creates a Shopify session for API calls
 * Uses custom app session (no OAuth flow needed)
 */
export const createShopifySession = (): Session => {
  const shop = SHOPIFY_SHOP_DOMAIN.replace('https://', '').replace('http://', '')

  return new Session({
    id: `offline_${shop}`,
    shop,
    state: 'offline',
    isOnline: false,
    accessToken: SHOPIFY_ACCESS_TOKEN,
  })
}

export default shopify
