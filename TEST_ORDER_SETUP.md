# Test Order Setup - Quick Guide

## Purpose

This guide helps you safely test the approval email feature without accidentally sending emails to real customers.

## How to Create a Test Order

### Step 1: Navigate to Test Tools
1. Log into the Custom Ops dashboard
2. Look for "Test Tools" in the sidebar under the "System" section (look for the 🧪 beaker icon)
3. Click "Test Tools"

### Step 2: Create Test Order
1. Your email (`timothy@hampsonproperties.com`) should already be filled in
2. Click the **"Create Test Order"** button
3. Wait a few seconds for the test order to be created

### Step 3: View the Test Order
Once created, you'll see a success message with:
- Order number (starts with "TEST-")
- Customer name: "Test Customer"
- Your email address

Click **"View Order"** or **"Test Approval Email"** to go directly to the order.

## What Gets Created

The test order includes:
- ✅ A Customify order clearly marked "🧪 TEST ORDER - Safe to Delete"
- ✅ 4 sample files:
  - **preview** - Test preview file from Customify
  - **design** - Test final design file
  - **other** - Test original customer image
  - **proof** - Test manually uploaded proof
- ✅ Order details (quantity, grip color, event date)
- ✅ Your email as the customer email

## Testing the Approval Email

### Step 1: Go to the Files Tab
1. Click on the test order
2. Navigate to the **Files** tab
3. You should see all 4 sample files displayed

### Step 2: Open Send Approval Email Dialog
1. Click the **"Send Approval Email"** button
2. The dialog will open showing all available files

### Step 3: Select a File
1. Choose any of the 4 sample files (they're all available now!)
2. The email preview will automatically load

### Step 4: Preview the Email
1. Click **"Show Preview"** to see the rendered email
2. You'll see:
   - Subject line
   - Full email body with your name
   - Embedded proof image
   - Approve/Reject buttons
   - Footer with contact info

### Step 5: Send Test Email
1. Click **"Send Approval Email"**
2. The email will be sent to your inbox (`timothy@hampsonproperties.com`)
3. Check your email to see the actual formatted approval email

### Step 6: Test the Approval Links
1. Open the email in your inbox
2. Click the **"Approve Design"** button (green)
3. You'll be taken to a confirmation page
4. The order status will automatically update

## Cleaning Up

When you're done testing:
1. Go to the Work Items page
2. Find the test order (marked with 🧪)
3. Delete it - all files and data will be automatically removed

## What You Can Test

✅ **File Selection** - All Customify file types show up (preview, design, other, proof)
✅ **Email Preview** - See exactly what the customer will receive
✅ **Email Sending** - Safely send to your own email
✅ **Email Content** - Verify formatting, images, buttons
✅ **Approval Links** - Test the approve/reject workflow
✅ **Status Updates** - See the order status change when approved/rejected

## Safety Features

- 🛡️ Test orders are clearly labeled so you won't confuse them with real orders
- 🛡️ Test emails only go to the email you specify
- 🛡️ Test orders are safe to delete at any time
- 🛡️ No real customers will ever see these test orders

## Common Issues

### "No files available" in the approval dialog
- Make sure you're viewing a test order created through the Test Tools page
- Check the Files tab to verify files were created

### Preview not loading
- Wait a few seconds - the preview loads automatically
- Check your browser console for errors
- Refresh the page and try again

### Email not sending
- Verify Microsoft Graph API credentials are set up
- Check that your email address is valid
- Look at server logs for detailed error messages

## Creating Multiple Test Orders

You can create as many test orders as you need:
1. Each order gets a unique order number (TEST-[timestamp])
2. All orders use your email address
3. Delete old test orders when you're done with them

## Next Steps

After testing:
1. ✅ Verify all Customify files show up in the dialog
2. ✅ Confirm email preview looks correct
3. ✅ Test sending and receiving the approval email
4. ✅ Try the approve/reject buttons in the email
5. ✅ Delete test orders when done

Now you're ready to use the approval email feature with real customers!
