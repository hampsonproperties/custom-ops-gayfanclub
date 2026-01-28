'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage templates, integrations, and system configuration</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Email Templates</CardTitle>
            <CardDescription>Manage email templates with merge fields</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Manage Templates</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shopify Integration</CardTitle>
            <CardDescription>Configure Shopify webhook and API settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Configure</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Microsoft 365</CardTitle>
            <CardDescription>Connect email account for sending and receiving</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Connect Account</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Follow-Up Rules</CardTitle>
            <CardDescription>Configure SLA thresholds and cadence rules</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled>Edit Rules</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
