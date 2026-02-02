# Email Features Implementation - Setup Guide

## Overview
This implementation adds two major email features:
1. **Customify Proof Approval Email**: Templated email with embedded image and JWT-based approval links
2. **Assisted Project CRM-Style Communication**: Inline email composer with file attachments and conversation threading

## Setup Steps

### 1. Apply Database Migration

Run the migration to add approval system tables and seed the email template:

```sql
-- Execute the migration file:
-- supabase/migrations/20260128000001_add_approval_system.sql
```

This migration adds:
- `approval_status` column to `work_items` table
- `approval_tokens` table for JWT-based approval links
- Email template for proof approval

### 2. Add Environment Variables

Add the following to your `.env.local` file:

```bash
# JWT Secret for approval token signing
JWT_SECRET=your-secure-random-secret-key-here

# Base URL for approval links (production)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

**To generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Install Dependencies

The following package was added during implementation:
```bash
npm install jsonwebtoken @types/jsonwebtoken
```

This should already be installed if you pulled the code, but verify with:
```bash
npm list jsonwebtoken
```

## Features Implemented

### Feature 1: Customify Proof Approval Email

**Location:** Work Items > [Work Item Detail] > Files Tab

**How it works:**
1. Click "Send Approval Email" button (visible for Customify orders only)
2. Select a proof file from the list
3. Preview shows how the email will look
4. Email is sent with:
   - Embedded proof image (7-day signed URL)
   - Approve/Reject buttons with JWT-signed links
   - Professional template styling

**Files Created:**
- `/lib/email/templates.ts` - Template system utilities
- `/app/api/send-approval-email/route.ts` - API endpoint for sending approval emails
- `/app/api/approve-proof/route.ts` - API endpoint for handling approval link clicks
- `/app/approve-proof/page.tsx` - Customer-facing approval confirmation page
- `/components/email/send-approval-dialog.tsx` - File selector dialog
- `/supabase/migrations/20260128000001_add_approval_system.sql` - Database migration

**Workflow:**
1. User uploads proof file to work item
2. User clicks "Send Approval Email" and selects proof
3. Customer receives email with embedded proof and approve/reject buttons
4. Customer clicks approve or reject
5. Work item status automatically updates to `awaiting_approval` → `approved` or `needs_customer_fix`
6. JWT tokens are one-time use and expire in 7 days

### Feature 2: Assisted Project CRM-Style Communication

**Location:** Work Items > [Work Item Detail] > Communication Tab

**How it works:**
1. Conversation thread displays all email history chronologically
2. Inline composer at bottom (no more modal dialogs)
3. Attach files from Files tab or upload new ones
4. Optional "Include proof approval links" checkbox for approval workflow
5. Send emails with attachments directly from the conversation view

**Files Created:**
- `/components/email/conversation-thread.tsx` - Email history display
- `/components/email/file-attachment-picker.tsx` - File selection and upload
- `/components/email/inline-email-composer.tsx` - CRM-style email composer

**Files Modified:**
- `/lib/hooks/use-communications.ts` - Added support for attachments and approval links
- `/app/api/email/send/route.ts` - Enhanced to handle file attachments via Microsoft Graph API
- `/app/(dashboard)/work-items/[id]/page.tsx` - Replaced modal with inline composer

**Workflow:**
1. View email history in chronological order
2. Click any email to expand/collapse details
3. Compose new email inline (no modal popup)
4. Attach files by selecting from work item or uploading new ones
5. Optionally include approval links (generates JWT tokens automatically)
6. Send email with attachments (max 4MB per file via Graph API)

## Testing

### Test Customify Proof Approval (Feature 1)

1. Navigate to a Customify order work item
2. Upload a proof file in the Files tab
3. Click "Send Approval Email"
4. Select the proof file and click "Send Approval Email"
5. Check the customer's email inbox
6. Verify:
   - Email received with embedded proof image
   - Approve/Reject buttons are present
   - Clicking "Approve" redirects to confirmation page
   - Work item status updates to "approved"
   - Clicking the link again shows "already used" error
   - Links expire after 7 days

### Test CRM-Style Communication (Feature 2)

1. Navigate to any work item (Customify or Assisted Project)
2. Go to Communication tab
3. Verify conversation thread shows existing emails
4. Click an email to expand/collapse
5. Use inline composer to compose a new email
6. Click "Attach Files" and select a proof file
7. Check "Include proof approval links" (if attaching a proof)
8. Send the email
9. Verify:
   - Email sent successfully
   - Appears in conversation thread immediately
   - Attachments are included in the email
   - If approval links were included, work item status updates to "awaiting_approval"

### Edge Cases to Test

- [ ] Expired approval tokens (manually adjust expires_at in DB)
- [ ] Used approval tokens (click approve link twice)
- [ ] Files larger than 4MB (should show warning and skip)
- [ ] Multiple file attachments in single email
- [ ] Email send failures (disconnect internet temporarily)
- [ ] Invalid JWT signatures (modify token manually)
- [ ] Work items without customer email (buttons should be disabled)

## Architecture Notes

### JWT Token Security
- Tokens are signed with `JWT_SECRET` environment variable
- Expiry set to 7 days (604800 seconds)
- One-time use enforced via `used_at` timestamp in database
- Stored in `approval_tokens` table for audit trail

### File Attachment Flow
1. Files are stored in Supabase Storage (`custom-ops-files` bucket)
2. For emails with attachments:
   - Files are downloaded from Supabase Storage
   - Converted to base64 for Microsoft Graph API
   - Size limit: 4MB per file (Graph API limit)
   - Multiple files can be attached

### Email Templates
- Stored in `templates` table in database
- Use `{{mergeField}}` syntax for dynamic values
- Template utilities: `getTemplateByKey()`, `renderTemplate()`
- Customify approval template key: `customify-proof-approval`

## Troubleshooting

### "JWT_SECRET not set" error
Add `JWT_SECRET` to `.env.local` file

### Approval links don't work
1. Check `NEXT_PUBLIC_BASE_URL` is set correctly
2. Verify migration was applied (check for `approval_tokens` table)
3. Check browser console for errors

### File attachments not sending
1. Verify file is in Supabase Storage
2. Check file size (max 4MB)
3. Check Microsoft Graph API credentials are valid
4. Look at server logs for download/conversion errors

### Inline composer not showing
1. Verify imports are correct in work item detail page
2. Check for TypeScript errors in components
3. Ensure `useCommunications` hook is working

## Success Criteria

✅ All phases completed:
- Phase 1: Template system foundation
- Phase 2: Approval mechanism (JWT tokens, API routes, confirmation page)
- Phase 3: Approval UI (dialog, work item integration)
- Phase 4: Inline composer components
- Phase 5: Email attachment support
- Phase 6: Integration (replaced modal with inline composer)

✅ Feature 1 works:
- Send templated approval email
- Embedded proof images
- JWT approval links
- One-time use enforcement
- Work item status updates

✅ Feature 2 works:
- Conversation threading
- Inline composer (no modal)
- File attachments
- Optional approval links
- CRM-style email flow

## Next Steps (Optional Enhancements)

1. **Email Templates UI**: Admin page to edit templates without SQL
2. **Batch Approvals**: Approve multiple proofs at once
3. **Approval Notifications**: Notify team when customer approves/rejects
4. **Rich Text Editor**: Replace textarea with WYSIWYG editor
5. **Email Scheduling**: Schedule emails to send later
6. **Auto-Follow-Ups**: Automatically send reminder if no response in X days

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Review server logs for detailed error messages
3. Verify all environment variables are set
4. Ensure database migration was applied successfully
