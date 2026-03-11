import { describe, it, expect } from 'vitest'
import {
  isFormSubmissionEmail,
  parseFormEmail,
  parsePowerfulFormEmail,
  isValidFormSubmission,
} from '../form-email-parser'

describe('isFormSubmissionEmail', () => {
  it('detects Powerful Form emails', () => {
    expect(isFormSubmissionEmail('no-reply@powerfulform.com', 'Custom Fan Inquiry')).toBe(true)
    expect(isFormSubmissionEmail('noreply@powerfulform.com', 'Custom Fan Inquiry')).toBe(true)
  })

  it('detects other form providers', () => {
    expect(isFormSubmissionEmail('forms-noreply@google.com', 'Form response')).toBe(true)
    expect(isFormSubmissionEmail('noreply@formstack.com', 'Submission')).toBe(true)
    expect(isFormSubmissionEmail('notifications@typeform.com', 'New response')).toBe(true)
  })

  it('rejects non-form emails', () => {
    expect(isFormSubmissionEmail('john@example.com', 'Hello')).toBe(false)
    expect(isFormSubmissionEmail('noreply@shopify.com', 'Order confirmation')).toBe(false)
  })

  it('is case insensitive', () => {
    expect(isFormSubmissionEmail('No-Reply@PowerfulForm.com', 'Inquiry')).toBe(true)
  })
})

describe('parsePowerfulFormEmail — Pattern 1 (asterisk-separated)', () => {
  const sampleBody = `Custom Fan Inquiry Submission * Your Name: Amy Baker * Organization: Oregon Country Fair * Email: amy@threadbarepress.com * Phone: 503-555-1234 * Project details: Hello! I am the owner of a screen printing shop. Each year we work with the Oregon Country Fair and this year they have requested fans. * Event date: July 15, 2026`

  it('extracts customer name', () => {
    const result = parsePowerfulFormEmail(sampleBody, null)
    expect(result?.customerName).toBe('Amy Baker')
  })

  it('extracts customer email', () => {
    const result = parsePowerfulFormEmail(sampleBody, null)
    expect(result?.customerEmail).toBe('amy@threadbarepress.com')
  })

  it('extracts phone number', () => {
    const result = parsePowerfulFormEmail(sampleBody, null)
    expect(result?.customerPhone).toBe('503-555-1234')
  })

  it('extracts organization', () => {
    const result = parsePowerfulFormEmail(sampleBody, null)
    expect(result?.organization).toBe('Oregon Country Fair')
  })

  it('extracts project details without truncation', () => {
    const result = parsePowerfulFormEmail(sampleBody, null)
    expect(result?.projectDetails).toContain('Hello! I am the owner of a screen printing shop')
    expect(result?.projectDetails).toContain('requested fans.')
  })

  it('extracts event date', () => {
    const result = parsePowerfulFormEmail(sampleBody, null)
    expect(result?.eventDate).toBe('July 15, 2026')
  })

  it('builds fullFormContent with all fields', () => {
    const result = parsePowerfulFormEmail(sampleBody, null)
    expect(result?.fullFormContent).toContain('Your Name: Amy Baker')
    expect(result?.fullFormContent).toContain('Email: amy@threadbarepress.com')
    expect(result?.fullFormContent).toContain('Phone: 503-555-1234')
  })

  it('handles project details as the last field (no trailing asterisk)', () => {
    const body = `Inquiry * Your Name: Naz Kask * Email: naz@example.com * Project details: I want custom fans for a big party with lots of people and multiple designs`
    const result = parsePowerfulFormEmail(body, null)
    expect(result?.projectDetails).toBe('I want custom fans for a big party with lots of people and multiple designs')
  })
})

describe('parsePowerfulFormEmail — Pattern 2 (line-by-line)', () => {
  const lineBody = `Custom Fan Inquiry Submission
Your Name: Naz Kask
Email: naz@example.com
Phone: 917-555-9876
Organization: Event Co
Project details: We need 500 custom fans for our annual gala.
The design should feature our logo prominently.
We also need them in two colors.
Event date: September 20, 2026`

  it('extracts all fields from line-by-line format', () => {
    const result = parsePowerfulFormEmail(lineBody, null)
    expect(result?.customerName).toBe('Naz Kask')
    expect(result?.customerEmail).toBe('naz@example.com')
    expect(result?.customerPhone).toBe('917-555-9876')
    expect(result?.organization).toBe('Event Co')
    expect(result?.eventDate).toBe('September 20, 2026')
  })

  it('captures multi-line project details', () => {
    const result = parsePowerfulFormEmail(lineBody, null)
    expect(result?.projectDetails).toContain('We need 500 custom fans')
    expect(result?.projectDetails).toContain('The design should feature our logo')
    expect(result?.projectDetails).toContain('two colors')
  })
})

describe('parsePowerfulFormEmail — Pattern 3 (HTML bold labels)', () => {
  const htmlBody = `<div>
    <p><strong>Your Name:</strong> Sam Rivera</p>
    <p><strong>Email:</strong> sam@rivera.net</p>
    <p><strong>Phone:</strong> 212-555-0042</p>
    <p><strong>Organization:</strong> Rivera Events</p>
    <p><strong>Project details:</strong> Looking for 200 custom fans</p>
  </div>`

  it('extracts fields from bold HTML labels', () => {
    // Pass empty bodyText to force HTML parsing
    const result = parsePowerfulFormEmail('', htmlBody)
    expect(result?.customerName).toBe('Sam Rivera')
    expect(result?.customerEmail).toBe('sam@rivera.net')
    expect(result?.customerPhone).toBe('212-555-0042')
    expect(result?.organization).toBe('Rivera Events')
  })
})

describe('parsePowerfulFormEmail — Pattern 4 (HTML table)', () => {
  const tableHtml = `<table>
    <tr><td>Your Name:</td><td>Kim Cho</td></tr>
    <tr><td>Email:</td><td>kim@cho.org</td></tr>
    <tr><td>Phone:</td><td>310-555-8888</td></tr>
  </table>`

  it('extracts fields from HTML table layout', () => {
    const result = parsePowerfulFormEmail('', tableHtml)
    expect(result?.customerName).toBe('Kim Cho')
    expect(result?.customerEmail).toBe('kim@cho.org')
    expect(result?.customerPhone).toBe('310-555-8888')
  })
})

describe('parsePowerfulFormEmail — Pattern 5 (fallback email extraction)', () => {
  it('extracts email from unstructured content', () => {
    const body = `Hi, someone named Jordan submitted a form. Their email is jordan@example.com and they want fans.`
    const result = parsePowerfulFormEmail(body, null)
    expect(result?.customerEmail).toBe('jordan@example.com')
  })

  it('filters out form provider emails', () => {
    const body = `From: no-reply@powerfulform.com. Customer email: real@customer.com`
    const result = parsePowerfulFormEmail(body, null)
    expect(result?.customerEmail).toBe('real@customer.com')
  })

  it('filters out company emails', () => {
    const body = `Sent to sales@thegayfanclub.com. From: buyer@example.com`
    const result = parsePowerfulFormEmail(body, null)
    expect(result?.customerEmail).toBe('buyer@example.com')
  })

  it('returns null when no customer email found', () => {
    const body = `This is a notification from no-reply@powerfulform.com with no customer info.`
    const result = parsePowerfulFormEmail(body, null)
    expect(result).toBeNull()
  })
})

describe('parseFormEmail — provider routing', () => {
  it('routes Powerful Form emails to the correct parser', () => {
    const body = `* Your Name: Test User * Email: test@example.com`
    const result = parseFormEmail('no-reply@powerfulform.com', 'Inquiry', body, null)
    expect(result?.customerEmail).toBe('test@example.com')
  })

  it('falls back to generic parser for unknown providers', () => {
    const body = `Your Name: Test\nEmail: test@other.com`
    const result = parseFormEmail('unknown@forms.io', 'Form', body, null)
    expect(result?.customerEmail).toBe('test@other.com')
  })
})

describe('isValidFormSubmission', () => {
  it('rejects null data', () => {
    expect(isValidFormSubmission(null)).toBe(false)
  })

  it('rejects data without email', () => {
    expect(isValidFormSubmission({
      customerName: 'Test',
      customerEmail: null,
      customerPhone: null,
      organization: null,
      projectDetails: null,
      eventDate: null,
      additionalFields: {},
      fullFormContent: null,
    })).toBe(false)
  })

  it('rejects invalid email formats', () => {
    expect(isValidFormSubmission({
      customerName: 'Test',
      customerEmail: 'not-an-email',
      customerPhone: null,
      organization: null,
      projectDetails: null,
      eventDate: null,
      additionalFields: {},
      fullFormContent: null,
    })).toBe(false)
  })

  it('accepts valid data with email', () => {
    expect(isValidFormSubmission({
      customerName: 'Amy',
      customerEmail: 'amy@example.com',
      customerPhone: null,
      organization: null,
      projectDetails: null,
      eventDate: null,
      additionalFields: {},
      fullFormContent: null,
    })).toBe(true)
  })
})

describe('edge cases', () => {
  it('handles empty body gracefully', () => {
    expect(parsePowerfulFormEmail('', null)).toBeNull()
    expect(parsePowerfulFormEmail('', '')).toBeNull()
  })

  it('handles email in "Name <email>" format', () => {
    const body = `* Your Name: Taylor * Email: Taylor Smith <taylor@smith.com>`
    const result = parsePowerfulFormEmail(body, null)
    expect(result?.customerEmail).toBe('taylor@smith.com')
  })

  it('handles extra whitespace in fields', () => {
    const body = `*  Your Name:   Jamie Lee   * Email:  jamie@lee.com  `
    const result = parsePowerfulFormEmail(body, null)
    expect(result?.customerName).toBe('Jamie Lee')
    expect(result?.customerEmail).toBe('jamie@lee.com')
  })

  it('stores unrecognized fields in additionalFields', () => {
    const body = `* Your Name: Pat * Email: pat@test.com * Budget: $5000 * Quantity: 300`
    const result = parsePowerfulFormEmail(body, null)
    expect(result?.additionalFields['Budget']).toBe('$5000')
    expect(result?.additionalFields['Quantity']).toBe('300')
  })
})
