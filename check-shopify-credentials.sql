-- Check if OAuth token was saved
SELECT shop, scope, created_at
FROM shopify_credentials
ORDER BY created_at DESC;
