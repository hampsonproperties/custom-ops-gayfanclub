/**
 * Email templates for quick responses
 */

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'lead' | 'design' | 'production' | 'general'
  description?: string
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // Lead/Sales Templates
  {
    id: 'initial-response',
    name: 'Initial Response',
    category: 'lead',
    subject: 'Re: Custom Fan Order',
    description: 'First response to a new inquiry',
    body: `Hi there!

Thanks so much for reaching out about custom fans! I'm excited to help you create something special for your event.

To get started, I'd love to learn more about your vision:

• What's the occasion/event?
• When do you need them by?
• How many fans are you thinking?
• Do you have any design ideas or artwork already?

Once I understand your needs, I'll put together a custom quote for you. Our design fee is $250, which gets you:
- Custom design mockup tailored to your event
- Up to 2 rounds of revisions
- $250 credit toward your production order

Looking forward to working with you!

Best,
Gay Fan Club Team`
  },
  {
    id: 'quote-follow-up',
    name: 'Quote Follow-Up',
    category: 'lead',
    subject: 'Following up on your custom fan quote',
    description: 'Follow up on a sent quote',
    body: `Hi there!

I wanted to follow up on the custom quote I sent over last week. I know planning events can be busy, so I wanted to make sure you didn't miss it!

I'm here to answer any questions you might have about:
- Pricing and quantity options
- Design process and timeline
- Shipping and delivery

If you're ready to move forward, we can get started right away with the design process.

Let me know how I can help!

Best,
Gay Fan Club Team`
  },
  {
    id: 'design-fee-invoice',
    name: 'Design Fee Invoice Sent',
    category: 'design',
    subject: 'Your Custom Fan Design Fee Invoice',
    description: 'Sent with design fee invoice link',
    body: `Hi!

Great news - I've created your design fee invoice!

You can pay securely here: [INVOICE_LINK]

Once payment is received, our designer will start working on your custom mockup. You'll typically see the first draft within 2-3 business days.

The $250 design fee includes:
- Custom design tailored to your specifications
- Up to 2 rounds of revisions
- $250 credit toward your production order (when you're ready to print!)

Excited to bring your vision to life!

Best,
Gay Fan Club Team`
  },
  {
    id: 'design-ready',
    name: 'Design Ready for Review',
    category: 'design',
    subject: 'Your Custom Fan Design is Ready! 🌈',
    description: 'Sending initial design mockup',
    body: `Hi!

Exciting news - your custom fan design is ready for review!

Please take a look at the attached mockup and let me know your thoughts. You get up to 2 rounds of revisions included, so don't hesitate to request changes.

Things to review:
- Overall layout and composition
- Colors and text
- Logo/artwork placement
- Any additional details you'd like adjusted

Once you approve the design, I'll send over the production invoice. Remember, your $250 design fee will be credited toward your order!

Can't wait to hear what you think!

Best,
Gay Fan Club Team`
  },
  {
    id: 'production-invoice',
    name: 'Production Invoice Sent',
    category: 'production',
    subject: 'Your Custom Fan Production Invoice',
    description: 'Sent with production invoice link',
    body: `Hi!

Your design is approved and looks amazing! I've created your production invoice:

[INVOICE_LINK]

As discussed, your $250 design fee has been credited to this order. Once payment is received, we'll begin production right away.

Timeline:
- Production: 2-3 weeks
- Shipping: 3-5 business days (domestic)

I'll keep you updated throughout the process!

Best,
Gay Fan Club Team`
  },
  {
    id: 'production-update',
    name: 'Production Update',
    category: 'production',
    subject: 'Update on Your Custom Fan Order',
    description: 'General production status update',
    body: `Hi!

Just wanted to give you a quick update on your custom fan order!

Your fans are currently in production and everything is looking great. We're still on track to ship by [DATE].

I'll send you tracking information as soon as they ship!

Let me know if you have any questions.

Best,
Gay Fan Club Team`
  },
  {
    id: 'shipping-notification',
    name: 'Shipping Notification',
    category: 'production',
    subject: 'Your Custom Fans Have Shipped! 📦',
    description: 'Order has been shipped',
    body: `Hi!

Great news - your custom fans have shipped!

Tracking Number: [TRACKING_NUMBER]
Carrier: [CARRIER]
Expected Delivery: [DATE]

You can track your package here: [TRACKING_LINK]

Your fans should arrive in plenty of time for your event. If you have any questions or concerns, please don't hesitate to reach out.

Thanks for choosing Gay Fan Club!

Best,
Gay Fan Club Team`
  },
  {
    id: 'thank-you',
    name: 'Thank You / Follow-Up',
    category: 'general',
    subject: 'Thank you for your order!',
    description: 'Post-delivery thank you',
    body: `Hi!

I hope your custom fans arrived safely and you love them!

I'd be thrilled to see photos from your event if you're willing to share. We love featuring our customers' creations!

If you need fans for future events, you already have a design on file, which makes reordering super easy.

Thanks again for choosing Gay Fan Club!

Best,
Gay Fan Club Team`
  },
  {
    id: 'pricing-info',
    name: 'Pricing Information',
    category: 'lead',
    subject: 'Custom Fan Pricing & Options',
    description: 'Detailed pricing breakdown',
    body: `Hi!

Thanks for your interest in custom fans! Here's our pricing structure:

DESIGN FEE: $250 (one-time)
- Custom design mockup
- 2 rounds of revisions
- $250 credit toward production

PRODUCTION PRICING (per fan):
- 50-99 fans: $12 each
- 100-249 fans: $10 each
- 250-499 fans: $8 each
- 500+ fans: $7 each

SHIPPING:
- Domestic: $25-50 (depending on quantity)
- Rush options available

TIMELINE:
- Design: 2-3 business days
- Production: 2-3 weeks after approval
- Shipping: 3-5 business days

What quantity are you thinking? I'd be happy to put together a custom quote!

Best,
Gay Fan Club Team`
  },
]

export function getTemplateById(id: string): EmailTemplate | undefined {
  return EMAIL_TEMPLATES.find(t => t.id === id)
}

export function getTemplatesByCategory(category: EmailTemplate['category']): EmailTemplate[] {
  return EMAIL_TEMPLATES.filter(t => t.category === category)
}

export function getAllTemplates(): EmailTemplate[] {
  return EMAIL_TEMPLATES
}

// Replace placeholders in template body
export function fillTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\[${key}\\]`, 'g'), value)
  }

  return result
}
