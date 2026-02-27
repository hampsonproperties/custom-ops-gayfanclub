'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FileText, Sparkles } from 'lucide-react'
import { EMAIL_TEMPLATES, type EmailTemplate } from '@/lib/email-templates'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TemplateSelectorProps {
  onSelectTemplate: (template: EmailTemplate) => void
}

export function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categories = [
    { id: 'all', name: 'All Templates', color: 'bg-gray-100 text-gray-800' },
    { id: 'lead', name: 'Sales & Leads', color: 'bg-blue-100 text-blue-800' },
    { id: 'design', name: 'Design', color: 'bg-purple-100 text-purple-800' },
    { id: 'production', name: 'Production', color: 'bg-green-100 text-green-800' },
    { id: 'general', name: 'General', color: 'bg-orange-100 text-orange-800' },
  ]

  const filteredTemplates =
    selectedCategory === 'all'
      ? EMAIL_TEMPLATES
      : EMAIL_TEMPLATES.filter((t) => t.category === selectedCategory)

  const handleSelectTemplate = (template: EmailTemplate) => {
    onSelectTemplate(template)
    setOpen(false)
  }

  const getCategoryColor = (category: string) => {
    const cat = categories.find((c) => c.id === category)
    return cat?.color || 'bg-gray-100 text-gray-800'
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Use Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Email Templates
          </DialogTitle>
          <DialogDescription>
            Choose a pre-written template to save time. You can customize it after selecting.
          </DialogDescription>
        </DialogHeader>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 pb-4 border-b">
          {categories.map((cat) => (
            <Badge
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              className={`cursor-pointer ${
                selectedCategory === cat.id ? '' : 'hover:bg-muted'
              }`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name}
            </Badge>
          ))}
        </div>

        {/* Templates List */}
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {template.description}
                      </p>
                    )}
                  </div>
                  <Badge className={getCategoryColor(template.category)} variant="secondary">
                    {template.category}
                  </Badge>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">Subject:</span>
                    <span className="font-mono">{template.subject}</span>
                  </div>
                  <div className="mt-2 p-2 bg-muted/30 rounded text-muted-foreground border">
                    <p className="line-clamp-3 whitespace-pre-line font-mono text-[10px]">
                      {template.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No templates found in this category</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="text-xs text-muted-foreground border-t pt-3">
          💡 Tip: Templates may contain placeholders like [INVOICE_LINK] or [DATE] that you'll need
          to replace with actual values.
        </div>
      </DialogContent>
    </Dialog>
  )
}
