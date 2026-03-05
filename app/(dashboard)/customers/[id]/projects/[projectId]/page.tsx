import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { User } from 'lucide-react'
import { ProjectDetailView } from '@/components/customers/project-detail-view'
import { Breadcrumbs } from '@/components/ui/breadcrumbs'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string; projectId: string }>
}) {
  const { id: customerId, projectId } = await params
  const supabase = await createClient()

  // Fetch customer info for context
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id, display_name, email')
    .eq('id', customerId)
    .single()

  if (customerError || !customer) {
    notFound()
  }

  // Fetch project info for title
  const { data: project, error: projectError } = await supabase
    .from('work_items')
    .select('id, shopify_order_number, title')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    notFound()
  }

  const customerName = customer.display_name || customer.email
  const projectTitle = project.title || `Order #${project.shopify_order_number}`

  return (
    <div className="min-h-full bg-muted/30">
      {/* Customer Context Header */}
      <div className="bg-background border-b">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Breadcrumbs
            items={[
              { label: 'Customers', href: '/customers' },
              { label: customerName, href: `/customers/${customerId}`, icon: User },
            ]}
            current={projectTitle}
          />
        </div>
      </div>

      {/* Project Detail Content */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ProjectDetailView
          projectId={projectId}
          customerId={customerId}
          customerName={customerName}
        />
      </div>
    </div>
  )
}
