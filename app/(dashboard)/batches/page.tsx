'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package } from 'lucide-react'

export default function BatchesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Batch Builder</h1>
        <p className="text-muted-foreground">Group orders for production and create batch exports</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Batch Builder Coming Soon</p>
          <p className="text-sm text-muted-foreground mb-4">
            This feature will allow you to group approved orders into production batches
          </p>
          <Button disabled>Create New Batch</Button>
        </CardContent>
      </Card>
    </div>
  )
}
