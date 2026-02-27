# PDR v3 Remaining Work

## Critical Priority: Mobile Responsiveness

The following pages MUST be made mobile responsive with table-to-card conversions:

### 1. Batches Page
**File**: `app/(dashboard)/batches/page.tsx`
**Current State**: Table layout only
**Required Changes**:
- Convert table to cards on mobile (<768px)
- Each card should show:
  - Batch name/number
  - Creation date
  - Item count
  - Status badge
  - Action buttons
- Ensure batch selection UI is touch-friendly
- Touch targets minimum 44px

### 2. Work Items Page
**File**: `app/(dashboard)/work-items/page.tsx`
**Current State**: Table layout only
**Required Changes**:
- Convert table to cards on mobile
- Each card should show:
  - Project title/ID
  - Customer name
  - Status badge (colored per PDR v3)
  - Priority indicator
  - Due date
  - Quick actions
- Filter and search must work on mobile
- Touch-friendly interaction

### 3. Customify Orders Page
**File**: `app/(dashboard)/customify-orders/page.tsx`
**Current State**: Needs review and mobile optimization
**Required Changes**:
- Ensure no duplication with design queue pages
- Convert to card layout on mobile
- Show order details clearly
- Touch-friendly status updates

### 4. Custom Design Queue Page
**File**: `app/(dashboard)/custom-design-queue/page.tsx`
**Current State**: Needs mobile optimization
**Required Changes**:
- Card layout for mobile
- Clear status indicators
- Easy navigation to project details
- Touch-friendly actions

### 5. Approved Designs Page
**File**: `app/(dashboard)/approved-designs/page.tsx`
**Current State**: Needs mobile optimization
**Required Changes**:
- Card layout showing approved projects
- Batch assignment UI on mobile
- Touch-friendly selection
- Clear visual hierarchy

### 6. Inbox Pages
**Files**: Various inbox pages
**Current State**: Needs mobile optimization
**Required Changes**:
- Email list as cards on mobile
- Touch-friendly message selection
- Swipe gestures consideration
- Responsive composer

## Secondary Priority: Feature Additions

### AI Integration - Email Composer
**Location**: Email composer component
**Required Changes**:
- Add "Summarize" button placeholder
- Add "Draft Reply" button placeholder
- Add "Extract Info" button placeholder
- Position above or beside compose area
- Follow PDR v3 button styling

### Batch Detail Page - Drip Email Timeline
**Location**: Batch detail page
**Required Changes**:
- Visual timeline showing:
  - Scheduled drip emails
  - Sent status
  - Email types
  - Dates/times
- Color coding for sent/pending
- Touch-friendly on mobile

### Status Badge Standardization
**Location**: All pages with status displays
**Required Changes**:
- Pending: Yellow (#FFC107)
- In Progress: Blue (#2196F3)
- Completed: Green (#4CAF50)
- Urgent: Red (#F44336)
- Apply consistently across:
  - Work items
  - Batches
  - Communications
  - Projects

## Design System Refinements

### Color Consistency
- Ensure all status badges use PDR v3 colors
- Verify gradient backgrounds match specification
- Check hover states across all components

### Typography
- Verify font hierarchy on all pages
- Ensure readability on mobile
- Check line heights and spacing

### Animations
- All transitions should be 150ms
- Smooth, Apple-style animations
- No janky or slow transitions

### Spacing
- Consistent padding/margins
- Proper touch target sizes (44px min)
- Adequate whitespace on mobile

## Testing Requirements

### Mobile Testing
- Test all pages on:
  - iPhone SE (375px width)
  - iPhone 12/13/14 (390px width)
  - iPhone Pro Max (428px width)
  - Android standard (360px width)
- Verify touch targets
- Check scroll behavior
- Test landscape orientation

### Desktop Testing
- Test on common resolutions:
  - 1920x1080
  - 1440x900
  - 2560x1440
- Verify sidebar behavior
- Check table layouts
- Test navigation

### Cross-Browser Testing
- Safari (iOS and macOS)
- Chrome
- Firefox
- Edge

## Implementation Priority Order

1. **Batches page mobile** (most frequently used)
2. **Work items page mobile** (high frequency)
3. **Design queue pages mobile** (workflow critical)
4. **Approved designs mobile** (workflow critical)
5. **Inbox mobile** (communication critical)
6. **Status badge standardization** (visual consistency)
7. **AI button placeholders** (future feature prep)
8. **Drip email timeline** (enhanced UX)

## Notes

- All mobile conversions should follow the pattern established in customers page
- Use `hidden md:block` for tables, `md:hidden` for cards
- Maintain data structure and functionality
- Ensure all interactive elements are touch-friendly
- Test thoroughly on actual mobile devices
