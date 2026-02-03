export type ShopifyOrderType = 'customify_order' | 'custom_design_service' | 'custom_bulk_order' | null

export function detectOrderType(order: any): ShopifyOrderType {
  // Check for Custom Design Service (design fee only)
  for (const item of order.line_items || []) {
    const title = item.title?.toLowerCase() || ''
    if (
      title.includes('professional custom fan design service') ||
      title.includes('custom fan design service') ||
      title.includes('design service & credit') ||
      title.includes('custom fan designer')
    ) {
      return 'custom_design_service'
    }
  }

  // Check for Etsy custom orders (has Personalization properties)
  for (const item of order.line_items || []) {
    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        const propName = prop.name?.toLowerCase() || ''
        if (propName.includes('personalization')) {
          return 'custom_bulk_order'
        }
      }
    }
  }

  // Check for Customify (has Customify properties)
  for (const item of order.line_items || []) {
    if (item.properties) {
      const props = Array.isArray(item.properties) ? item.properties : []
      for (const prop of props) {
        const propName = prop.name?.toLowerCase() || ''
        if (propName.includes('customify')) {
          return 'customify_order'
        }
      }
    }

    const title = item.title?.toLowerCase() || ''
    if (title.includes('customify')) {
      return 'customify_order'
    }
  }

  // Check for bulk orders (customer-provided artwork)
  for (const item of order.line_items || []) {
    const title = item.title?.toLowerCase() || ''
    if (title.includes('bulk order') || title.includes('bulk fan') || title.includes('custom bulk')) {
      return 'custom_bulk_order'
    }
  }

  // Check order tags
  const tags = order.tags?.toLowerCase() || ''
  if (tags.includes('customify')) {
    return 'customify_order'
  }
  if (tags.includes('custom bulk')) {
    return 'custom_bulk_order'
  }
  if (tags.includes('custom design')) {
    return 'custom_design_service'
  }
  if (tags.includes('etsy')) {
    return 'custom_bulk_order'
  }

  return null
}
