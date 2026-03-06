/**
 * Centralized configuration values
 *
 * All magic numbers and hardcoded settings extracted here
 * so they can be tuned in one place.
 */

// ── Shopify ──

/** Shopify REST Admin API version used for manual fetch() calls */
export const SHOPIFY_API_VERSION = '2026-01'

/** Design fee charged for the first proof (in dollars) */
export const DESIGN_FEE_AMOUNT = 35

// ── Email lookback windows ──

/** Days to look back when auto-linking emails to a new work item */
export const EMAIL_AUTOLINK_LOOKBACK_DAYS = 30

/** Days to look back when linking emails during import */
export const EMAIL_IMPORT_LOOKBACK_DAYS = 60

/** Minutes to look back in the cron email import (with overlap for safety) */
export const EMAIL_CRON_LOOKBACK_MINUTES = 30

// ── Batch drip email schedule (days after batch confirmed) ──

export const DRIP_EMAIL_SCHEDULE = {
  /** Email 2: "Shipped from facility" */
  email2_days: 7,
  /** Email 3: "Going through customs" */
  email3_days: 14,
  /** Email 4: "Arrived at warehouse" */
  email4_days: 21,
} as const

// ── Retry / DLQ ──

/** Exponential backoff delays in minutes: 5m → 15m → 45m → 2h → 6h */
export const DLQ_RETRY_DELAYS_MINUTES = [5, 15, 45, 120, 360] as const

// ── Approval / proof emails ──

/** Signed URL and JWT token expiry for proof approval links (seconds) */
export const APPROVAL_TOKEN_EXPIRY_SECONDS = 604800 // 7 days

// ── Form providers (exempt from junk filter) ──

export const FORM_PROVIDER_DOMAINS = [
  'powerfulform.com',
  'forms-noreply@google.com',
  'formstack.com',
  'typeform.com',
  'jotform.com',
  'wufoo.com',
] as const
