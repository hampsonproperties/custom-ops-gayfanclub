/**
 * Test script for form email parser
 * Tests parsing of Powerful Form submission emails
 */

import { parseFormEmail, isFormSubmissionEmail, isValidFormSubmission } from '../lib/utils/form-email-parser'

// Sample email from screenshot
const sampleEmail = {
  from: 'no-reply@powerfulform.com',
  subject: 'TGFC x Amy Baker Custom Fan Inquiry',
  body: `Custom Fan Inquiry Submission * Your Name: Amy Baker * Organization: Oregon Country Fair * Email: amy@threadbarepress.com * Project details: Hello! I am the owner of a screen printing shop. Each year we work with the Oregon Country Fair and this year they have requested fans. I stumbled on your amazing company! They have a commemorative poster that is used each year. It's too large to attach here....`,
}

console.log('Testing Form Email Parser')
console.log('=' .repeat(60))

// Test 1: Form detection
console.log('\n1. Testing form email detection:')
const isForm = isFormSubmissionEmail(sampleEmail.from, sampleEmail.subject)
console.log(`   Is form submission: ${isForm ? '✓ YES' : '✗ NO'}`)

// Test 2: Parse email
console.log('\n2. Testing email parsing:')
const parsed = parseFormEmail(sampleEmail.from, sampleEmail.subject, sampleEmail.body, null)
console.log('   Parsed data:', JSON.stringify(parsed, null, 2))

// Test 3: Validation
console.log('\n3. Testing validation:')
const isValid = isValidFormSubmission(parsed)
console.log(`   Is valid submission: ${isValid ? '✓ YES' : '✗ NO'}`)

// Test 4: Expected values
console.log('\n4. Checking expected values:')
const checks = [
  { name: 'Customer Name', expected: 'Amy Baker', actual: parsed?.customerName },
  { name: 'Customer Email', expected: 'amy@threadbarepress.com', actual: parsed?.customerEmail },
  { name: 'Organization', expected: 'Oregon Country Fair', actual: parsed?.organization },
  { name: 'Project Details', expected: 'Hello!', actual: parsed?.projectDetails?.substring(0, 6) },
]

checks.forEach(check => {
  const match = check.actual === check.expected
  console.log(`   ${match ? '✓' : '✗'} ${check.name}: ${check.actual}`)
})

console.log('\n' + '='.repeat(60))
console.log('Test complete!')
