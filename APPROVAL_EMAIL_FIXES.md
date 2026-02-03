# Approval Email Fixes - Implementation Summary

## Issues Fixed

### 1. Customify Files Not Showing in Approval Dialog
**Problem:** When importing Customify orders from Shopify, the uploaded images (design, preview, other) were being stored but not showing up in the "Send Approval Email" dialog because it only filtered for `kind === 'proof'`.

**Solution:** Updated the file filter in `send-approval-dialog.tsx` to include:
- `proof` (manual uploads)
- `preview` (Customify design previews)
- `design` (Customify final designs)
- `other` (Customify original images)

**Files Modified:**
- `custom-ops/components/email/send-approval-dialog.tsx` (lines 37-46)

### 2. No Email Preview Before Sending
**Problem:** The dialog would send the approval email immediately without showing what the email looks like. Users couldn't verify the content before it went to customers.

**Solution:** Added a full email preview system:
1. Created new API endpoint `/api/preview-approval-email` that renders the template with merge fields
2. Added auto-loading preview when a file is selected
3. Added show/hide toggle for the preview
4. Preview displays both subject line and full HTML email body
5. Uses iframe for safe HTML rendering

**Files Created:**
- `custom-ops/app/api/preview-approval-email/route.ts` - Preview API endpoint

**Files Modified:**
- `custom-ops/components/email/send-approval-dialog.tsx` - Added preview UI and logic

## How It Works Now

### File Selection
1. Dialog shows ALL files from Customify imports (preview, design, other) plus any manually uploaded proofs
2. Files are categorized with labels like "preview (Customify)" to show their source
3. Version numbers are displayed for each file

### Email Preview
1. When you select a file, the preview automatically loads
2. Click "Show Preview" to see exactly what the customer will receive
3. Preview shows:
   - **Subject line:** "Your Custom Fan Order #[number] - Design Ready for Approval"
   - **Full email body:** Greeting, embedded proof image, approve/reject buttons, footer
4. Preview uses placeholder tokens (PREVIEW_APPROVE_TOKEN) so links are visible but non-functional

### Email Content
The email that gets sent includes:
- Customer greeting with their name
- Order number reference
- Embedded proof image (7-day signed URL)
- Green "Approve Design" button
- Red "Request Changes" button
- Contact information footer

## Technical Details

### API Endpoint: `/api/preview-approval-email`
- **Method:** POST
- **Body:** `{ workItemId: string, fileId: string }`
- **Response:** `{ success: boolean, subject: string, body: string, fileInfo: {...} }`
- Generates signed URLs for proof images (7-day expiry)
- Uses placeholder approval links for preview
- Renders template with actual customer data

### Security
- Preview uses iframe with `sandbox="allow-same-origin"` for safe HTML rendering
- Approval tokens in preview are clearly marked as "PREVIEW" tokens
- No actual approval links are created until email is sent

## Testing Steps

1. Navigate to a Customify order work item
2. Go to Files tab
3. Verify Customify-imported images are visible
4. Click "Send Approval Email"
5. Verify all Customify files appear in the selection list
6. Select a file
7. Preview should auto-load
8. Click "Show Preview" to view the email
9. Verify subject and body render correctly
10. Click "Send Approval Email" to send
11. Check customer inbox for correctly formatted email

## Future Enhancements (Optional)

- [ ] Edit email template before sending (draft mode)
- [ ] Save custom email templates per customer
- [ ] Attach multiple proofs in one email
- [ ] Add approval deadline/expiry date
- [ ] Email open tracking
- [ ] Automated follow-up reminders
