import { redirect } from 'next/navigation'
import { use } from 'react'

// Sales leads are work items in this system
// Redirect /sales-leads/[id] to /work-items/[id]
export default function SalesLeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  redirect(`/work-items/${id}`)
}
