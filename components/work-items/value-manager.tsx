'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUpdateWorkItem } from '@/lib/hooks/use-work-items'
import { DollarSign, Edit2, Check, X } from 'lucide-react'
import { toast } from 'sonner'

export function ValueManager({
  workItemId,
  estimatedValue,
}: {
  workItemId: string
  estimatedValue: number | null
}) {
  const updateWorkItem = useUpdateWorkItem()
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(estimatedValue?.toString() || '')

  const handleSave = async () => {
    try {
      const numValue = value ? parseFloat(value) : null
      await updateWorkItem.mutateAsync({
        id: workItemId,
        updates: { estimated_value: numValue },
      })
      toast.success('Value updated')
      setIsEditing(false)
    } catch (error) {
      toast.error('Failed to update value')
    }
  }

  const handleCancel = () => {
    setValue(estimatedValue?.toString() || '')
    setIsEditing(false)
  }

  const formatCurrency = (val: number | null) => {
    if (!val) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(val)
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="w-32 h-8"
          autoFocus
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleSave}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleCancel}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2 font-semibold"
      onClick={() => setIsEditing(true)}
    >
      <DollarSign className="h-4 w-4" />
      {formatCurrency(estimatedValue)}
      <Edit2 className="h-3 w-3 text-muted-foreground" />
    </Button>
  )
}
