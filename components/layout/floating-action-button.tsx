'use client'

import { useState } from 'react'
import { Plus, Users, FolderKanban, Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const router = useRouter()

  const quickActions = [
    {
      label: 'New Customer',
      icon: Users,
      action: () => {
        router.push('/customers?new=true')
        setShowOptions(false)
      },
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      label: 'New Project',
      icon: FolderKanban,
      action: () => {
        router.push('/work-items?new=true')
        setShowOptions(false)
      },
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      label: 'Compose Email',
      icon: Mail,
      action: () => {
        router.push('/inbox/my-inbox')
        setShowOptions(false)
      },
      color: 'bg-purple-500 hover:bg-purple-600',
    },
  ]

  return (
    <>
      {/* FAB Button - Mobile only, bottom-right */}
      <div className="md:hidden fixed bottom-20 right-4 z-40">
        {/* Quick Action Options */}
        {showOptions && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-2 mb-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                size="lg"
                className={`${action.color} text-white shadow-lg h-14 gap-3 justify-start min-w-[200px]`}
                onClick={action.action}
              >
                <action.icon className="h-5 w-5" />
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Main FAB Button */}
        <Button
          size="lg"
          className={`h-14 w-14 rounded-full shadow-xl transition-all duration-150 ${
            showOptions
              ? 'bg-gray-500 hover:bg-gray-600'
              : 'bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
          }`}
          onClick={() => setShowOptions(!showOptions)}
        >
          {showOptions ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </Button>
      </div>

      {/* Backdrop to close options */}
      {showOptions && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/20"
          onClick={() => setShowOptions(false)}
        />
      )}
    </>
  )
}
