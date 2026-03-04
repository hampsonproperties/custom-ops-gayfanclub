#!/bin/bash

# Email Subscription Management Script
# Usage: ./scripts/manage-email-subscription.sh [check|renew|import]

PRODUCTION_URL="${PRODUCTION_URL:-https://your-domain.com}"

case "$1" in
  check)
    echo "Checking active subscriptions..."
    curl -X GET "$PRODUCTION_URL/api/email/subscribe" | jq .
    ;;

  renew)
    echo "Renewing email subscription..."
    curl -X POST "$PRODUCTION_URL/api/email/subscribe" \
      -H "Content-Type: application/json" \
      -d "{\"notificationUrl\": \"$PRODUCTION_URL/api/webhooks/email\"}" | jq .
    ;;

  import)
    DAYS="${2:-7}"
    echo "Importing emails from last $DAYS days..."
    curl -X POST "$PRODUCTION_URL/api/email/import" \
      -H "Content-Type: application/json" \
      -d "{\"daysBack\": $DAYS, \"limit\": 100}" | jq .
    ;;

  *)
    echo "Usage: $0 [check|renew|import] [days]"
    echo ""
    echo "Commands:"
    echo "  check       - List active subscriptions"
    echo "  renew       - Renew email webhook subscription"
    echo "  import      - Import recent emails (optional: specify days, default 7)"
    echo ""
    echo "Example:"
    echo "  PRODUCTION_URL=https://your-domain.com $0 check"
    echo "  PRODUCTION_URL=https://your-domain.com $0 renew"
    echo "  PRODUCTION_URL=https://your-domain.com $0 import 14"
    exit 1
    ;;
esac
