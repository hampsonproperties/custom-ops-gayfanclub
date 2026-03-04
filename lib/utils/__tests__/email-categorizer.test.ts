import { describe, it, expect } from 'vitest'
import { autoCategorizEmail, explainCategorization } from '../email-categorizer'

describe('autoCategorizEmail', () => {
  // ── Notifications (system emails) ──

  it('categorizes no-reply sender as notification', () => {
    expect(
      autoCategorizEmail({ from: 'no-reply@shopify.com', subject: 'Order update' })
    ).toBe('notifications')
  })

  it('categorizes noreply sender as notification', () => {
    expect(
      autoCategorizEmail({ from: 'noreply@example.com', subject: 'Welcome' })
    ).toBe('notifications')
  })

  it('categorizes do-not-reply sender as notification', () => {
    expect(
      autoCategorizEmail({ from: 'do-not-reply@stripe.com', subject: 'Receipt' })
    ).toBe('notifications')
  })

  it('categorizes Shopify domain as notification', () => {
    expect(
      autoCategorizEmail({ from: 'mailer@shopify.com', subject: 'New order' })
    ).toBe('notifications')
  })

  it('categorizes Judge.me as notification', () => {
    expect(
      autoCategorizEmail({ from: 'support@judge.me', subject: 'New review' })
    ).toBe('notifications')
  })

  it('categorizes Faire as notification', () => {
    expect(
      autoCategorizEmail({ from: 'wholesale@info.faire.com', subject: 'Order update' })
    ).toBe('notifications')
  })

  it('categorizes Stripe as notification', () => {
    expect(
      autoCategorizEmail({ from: 'receipts@stripe.com', subject: 'Payment' })
    ).toBe('notifications')
  })

  it('categorizes @notifications. domain as notification', () => {
    expect(
      autoCategorizEmail({ from: 'alerts@notifications.example.com', subject: 'Alert' })
    ).toBe('notifications')
  })

  it('categorizes "order #" in subject as notification', () => {
    expect(
      autoCategorizEmail({ from: 'info@store.com', subject: 'Your order #1234 is confirmed' })
    ).toBe('notifications')
  })

  it('categorizes "tracking" in subject as notification', () => {
    expect(
      autoCategorizEmail({ from: 'info@store.com', subject: 'Tracking update for your package' })
    ).toBe('notifications')
  })

  it('categorizes "shipped" in subject as notification', () => {
    expect(
      autoCategorizEmail({ from: 'info@store.com', subject: 'Your item has shipped!' })
    ).toBe('notifications')
  })

  it('categorizes "refund" in subject as notification', () => {
    expect(
      autoCategorizEmail({ from: 'billing@store.com', subject: 'Refund processed' })
    ).toBe('notifications')
  })

  it('categorizes transactional body patterns as notification', () => {
    expect(
      autoCategorizEmail({
        from: 'info@store.com',
        subject: 'Update',
        body: 'Your order has been placed successfully.',
      })
    ).toBe('notifications')
  })

  // ── Promotional emails ──

  it('categorizes email with unsubscribe link as promotional', () => {
    expect(
      autoCategorizEmail({
        from: 'news@brand.com',
        subject: 'Check this out',
        htmlBody: '<a href="https://example.com/unsubscribe">Unsubscribe</a>',
      })
    ).toBe('promotional')
  })

  it('categorizes "unsubscribe" in body as promotional', () => {
    expect(
      autoCategorizEmail({
        from: 'news@brand.com',
        subject: 'Latest news',
        body: 'To unsubscribe from these emails, click here.',
      })
    ).toBe('promotional')
  })

  it('categorizes "opt out" in HTML as promotional', () => {
    expect(
      autoCategorizEmail({
        from: 'news@brand.com',
        subject: 'News',
        htmlBody: '<p>Click to opt out</p>',
      })
    ).toBe('promotional')
  })

  it('categorizes @email. domain as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'deals@email.etsy.com', subject: 'New stuff' })
    ).toBe('promotional')
  })

  it('categorizes @marketing. domain as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'team@marketing.brand.com', subject: 'Update' })
    ).toBe('promotional')
  })

  it('categorizes @newsletter. domain as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'weekly@newsletter.example.com', subject: 'This week' })
    ).toBe('promotional')
  })

  it('categorizes "sale" in subject as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'store@brand.com', subject: 'Big sale this weekend!' })
    ).toBe('promotional')
  })

  it('categorizes "% off" in subject as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'store@brand.com', subject: '50% off everything' })
    ).toBe('promotional')
  })

  it('categorizes "discount" in subject as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'store@brand.com', subject: 'Your exclusive discount code' })
    ).toBe('promotional')
  })

  it('categorizes "free shipping" in subject as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'store@brand.com', subject: 'Free shipping on all orders!' })
    ).toBe('promotional')
  })

  it('categorizes gift emoji in subject as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'store@brand.com', subject: '🎁 Special for you' })
    ).toBe('promotional')
  })

  it('categorizes party emoji in subject as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'store@brand.com', subject: '🎉 Celebrating our anniversary' })
    ).toBe('promotional')
  })

  it('categorizes money emoji in subject as promotional', () => {
    expect(
      autoCategorizEmail({ from: 'store@brand.com', subject: '💰 Save big today' })
    ).toBe('promotional')
  })

  // ── Primary (default) ──

  it('categorizes regular customer email as primary', () => {
    expect(
      autoCategorizEmail({
        from: 'customer@gmail.com',
        subject: 'Question about my order',
        body: 'Hi, I was wondering about the status of my custom fans.',
      })
    ).toBe('primary')
  })

  it('categorizes email with no subject as primary', () => {
    expect(
      autoCategorizEmail({ from: 'person@example.com' })
    ).toBe('primary')
  })

  // ── Priority: notifications > promotional ──

  it('notification takes priority over promotional signals', () => {
    // no-reply is a notification signal, unsubscribe is promotional
    expect(
      autoCategorizEmail({
        from: 'no-reply@store.com',
        subject: 'Order shipped',
        htmlBody: '<a>unsubscribe</a>',
      })
    ).toBe('notifications')
  })

  // ── Case insensitivity ──

  it('is case-insensitive for from address', () => {
    expect(
      autoCategorizEmail({ from: 'NO-REPLY@SHOPIFY.COM', subject: 'Order' })
    ).toBe('notifications')
  })

  it('is case-insensitive for subject', () => {
    expect(
      autoCategorizEmail({ from: 'info@store.com', subject: 'Your ORDER #1234' })
    ).toBe('notifications')
  })
})

describe('explainCategorization', () => {
  it('explains no-reply as system email', () => {
    const result = explainCategorization({ from: 'no-reply@example.com', subject: 'Test' })
    expect(result.category).toBe('notifications')
    expect(result.reason).toContain('No-reply')
  })

  it('explains Shopify notification', () => {
    const result = explainCategorization({ from: 'mailer@shopify.com', subject: 'Order' })
    expect(result.category).toBe('notifications')
    expect(result.reason).toContain('Shopify')
  })

  it('explains transactional subject', () => {
    const result = explainCategorization({ from: 'info@store.com', subject: 'Order #1234 shipped' })
    expect(result.category).toBe('notifications')
    expect(result.reason).toContain('Transactional')
  })

  it('explains unsubscribe as promotional', () => {
    const result = explainCategorization({
      from: 'news@brand.com',
      subject: 'Weekly update',
      htmlBody: '<a>unsubscribe</a>',
    })
    expect(result.category).toBe('promotional')
    expect(result.reason).toContain('unsubscribe')
  })

  it('explains marketing domain', () => {
    const result = explainCategorization({ from: 'news@email.brand.com', subject: 'Hello' })
    expect(result.category).toBe('promotional')
    expect(result.reason).toContain('Marketing')
  })

  it('explains default as customer inquiry', () => {
    const result = explainCategorization({ from: 'customer@gmail.com', subject: 'Hello' })
    expect(result.category).toBe('primary')
    expect(result.reason).toContain('Default')
  })
})
