'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { FileText, Sparkles, Loader2 } from 'lucide-react'
import { useQuickReplyTemplates, type QuickReplyTemplate } from '@/lib/hooks/use-templates'
import { ScrollArea } from '@/components/ui/scroll-area'

// The shape the email composer expects when a template is selected
export interface SelectedTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: string
  description?: string
}

interface TemplateSelectorProps {
  onSelectTemplate: (template: SelectedTemplate) => void
}

const CATEGORIES = [
  { id: 'all', name: 'All Templates', color: 'bg-gray-100 text-gray-800' },
  { id: 'lead', name: 'Sales & Leads', color: 'bg-blue-100 text-blue-800' },
  { id: 'design', name: 'Design', color: 'bg-purple-100 text-purple-800' },
  { id: 'production', name: 'Production', color: 'bg-green-100 text-green-800' },
  { id: 'support', name: 'Support', color: 'bg-orange-100 text-orange-800' },
  { id: 'general', name: 'General', color: 'bg-gray-100 text-gray-800' },
]

function toSelectedTemplate(t: QuickReplyTemplate): SelectedTemplate {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject_template || '',
    body: t.body_html_template,
    category: t.category || 'general',
    description: t.description || undefined,
  }
}

export function TemplateSelector({ onSelectTemplate }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const { data: templates, isLoading } = useQuickReplyTemplates()

  const filteredTemplates =
    selectedCategory === 'all'
      ? templates ?? []
      : (templates ?? []).filter((t) => t.category === selectedCategory)

  const handleSelectTemplate = (template: QuickReplyTemplate) => {
    onSelectTemplate(toSelectedTemplate(template))
    setOpen(false)
  }

  const getCategoryColor = (category: string | null) => {
    const cat = CATEGORIES.find((c) => c.id === category)
    return cat?.color || 'bg-gray-100 text-gray-800'
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Use Template
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        {/* Drag handle indicator */}
        <div className="mx-auto w-10 h-1 bg-muted-foreground/30 rounded-full mb-4 -mt-1" />

        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Email Templates
          </SheetTitle>
          <SheetDescription>
            Choose a pre-written template to save time. You can customize it after selecting.
          </SheetDescription>
        </SheetHeader>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 pb-4 border-b mt-4">
          {CATEGORIES.map((cat) => (
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
        <ScrollArea className="h-[50vh] sm:h-[400px] pr-4 mt-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
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
                      {template.category || 'general'}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs">
                    {template.subject_template && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-medium">Subject:</span>
                        <span className="font-mono">{template.subject_template}</span>
                      </div>
                    )}
                    <div className="mt-2 p-2 bg-muted/30 rounded text-muted-foreground border">
                      <p className="line-clamp-3 whitespace-pre-line font-mono text-[10px]">
                        {template.body_html_template}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {filteredTemplates.length === 0 && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No templates found in this category</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="text-xs text-muted-foreground border-t pt-3 mt-4">
          Tip: Templates may contain placeholders like [INVOICE_LINK] or [DATE] that you'll need
          to replace with actual values. Manage templates in Settings.
        </div>
      </SheetContent>
    </Sheet>
  )
}
