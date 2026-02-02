'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useFiles, useUploadFile } from '@/lib/hooks/use-files'
import { Paperclip, X, Upload, File as FileIcon, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'

interface FileAttachmentPickerProps {
  workItemId: string
  selectedFileIds: string[]
  onSelectionChange: (fileIds: string[]) => void
}

export function FileAttachmentPicker({
  workItemId,
  selectedFileIds,
  onSelectionChange,
}: FileAttachmentPickerProps) {
  const { data: files = [] } = useFiles(workItemId)
  const uploadFile = useUploadFile()
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadingFile, setUploadingFile] = useState<File | null>(null)

  const handleToggleFile = (fileId: string) => {
    if (selectedFileIds.includes(fileId)) {
      onSelectionChange(selectedFileIds.filter((id) => id !== fileId))
    } else {
      onSelectionChange([...selectedFileIds, fileId])
    }
  }

  const handleQuickUpload = async () => {
    if (!uploadingFile) {
      toast.error('Please select a file')
      return
    }

    try {
      const result = await uploadFile.mutateAsync({
        workItemId,
        file: uploadingFile,
        kind: 'proof',
        note: '',
      })

      // Auto-select the newly uploaded file
      onSelectionChange([...selectedFileIds, result.id])

      toast.success('File uploaded and attached')
      setUploadingFile(null)
      setShowUploadForm(false)
    } catch (error) {
      toast.error('Failed to upload file')
    }
  }

  const selectedFiles = files.filter((f) => selectedFileIds.includes(f.id))

  return (
    <div className="space-y-3">
      {/* Selected Files Display */}
      {selectedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedFiles.map((file) => (
            <div
              key={file.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-sm"
            >
              {file.mime_type?.startsWith('image/') ? (
                <ImageIcon className="h-3 w-3" />
              ) : (
                <FileIcon className="h-3 w-3" />
              )}
              <span className="max-w-[150px] truncate">{file.original_filename}</span>
              <button
                onClick={() => handleToggleFile(file.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File Picker Button */}
      {!showUploadForm && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowUploadForm(!showUploadForm)}
            className="gap-2"
          >
            <Paperclip className="h-4 w-4" />
            {selectedFileIds.length > 0 ? 'Attach More Files' : 'Attach Files'}
          </Button>
          {selectedFileIds.length > 0 && (
            <span className="text-xs text-muted-foreground self-center">
              {selectedFileIds.length} file{selectedFileIds.length > 1 ? 's' : ''} attached
            </span>
          )}
        </div>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Quick Upload & Attach</h4>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setUploadingFile(e.target.files?.[0] || null)}
              disabled={uploadFile.isPending}
            />
          </div>

          {/* Existing Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Or select from existing files:</h4>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {files.map((file) => {
                  const isSelected = selectedFileIds.includes(file.id)
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => handleToggleFile(file.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {file.mime_type?.startsWith('image/') ? (
                          <ImageIcon className="h-4 w-4 flex-shrink-0" />
                        ) : (
                          <FileIcon className="h-4 w-4 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate">{file.original_filename}</span>
                        {isSelected && <X className="h-3 w-3 flex-shrink-0" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowUploadForm(false)
                setUploadingFile(null)
              }}
            >
              Cancel
            </Button>
            {uploadingFile && (
              <Button
                type="button"
                size="sm"
                onClick={handleQuickUpload}
                disabled={uploadFile.isPending}
              >
                <Upload className="h-3 w-3 mr-1" />
                {uploadFile.isPending ? 'Uploading...' : 'Upload & Attach'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
