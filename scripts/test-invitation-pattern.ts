// Quick test of invitation pattern

const title = "You're Invited: 2026 NGLCC Black History Program | Tuesday, February 24, 2026".toLowerCase()
const isInvitation = /you're invited|invitation|event invitation|rsvp/i.test(title)

console.log('Title:', title)
console.log('isInvitation:', isInvitation)
console.log('Pattern test:', /you're invited/i.test(title))
