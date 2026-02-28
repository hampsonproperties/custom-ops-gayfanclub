'use client'

import { useState, useCallback } from 'react'
import { Upload, X, File, Image as ImageIcon, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  projectId: string
  customerId: string
  onUploadComplete?: () => void
  maxFiles?: number
  maxSizeMB?: number
  acceptedTypes?: string[]
}

interface UploadingFile {
  file: File
  progress: number
  error?: string
}

export function FileUpload({
  projectId,
  customerId,
  onUploadComplete,
  maxFiles = 10,
  maxSizeMB = 50,
  acceptedTypes = ['image/*', 'application/pdf', '.ai', '.psd', '.eps', '.svg']
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const validateFile = (file: File): string | null => {
    // Check file size
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > maxSizeMB) {
      return `File ${file.name} is too large (${sizeMB.toFixed(1)}MB). Maximum size is ${maxSizeMB}MB.`
    }

    return null
  }

  const uploadFile = async (file: File): Promise<void> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)
    formData.append('customerId', customerId)

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()

      // Update progress to 100%
      setUploadingFiles(prev =>
        prev.map(f => f.file === file ? { ...f, progress: 100 } : f)
      )

      // Remove from uploading list after a short delay
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(f => f.file !== file))
      }, 1000)

      toast.success(`${file.name} uploaded successfully`)
    } catch (error: any) {
      setUploadingFiles(prev =>
        prev.map(f => f.file === file ? { ...f, error: error.message } : f)
      )
      toast.error(`Failed to upload ${file.name}: ${error.message}`)
    }
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    // Validate file count
    if (fileArray.length > maxFiles) {
      toast.error(`You can only upload ${maxFiles} files at a time`)
      return
    }

    // Validate each file
    const validFiles: File[] = []
    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        toast.error(error)
      } else {
        validFiles.push(file)
      }
    }

    if (validFiles.length === 0) return

    // Add to uploading list
    const newUploads: UploadingFile[] = validFiles.map(file => ({
      file,
      progress: 0
    }))
    setUploadingFiles(prev => [...prev, ...newUploads])

    // Upload files
    for (const file of validFiles) {
      await uploadFile(file)
    }

    // Call completion callback
    if (onUploadComplete) {
      onUploadComplete()
    }
  }, [maxFiles, maxSizeMB, projectId, customerId, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
    // Reset input
    e.target.value = ''
  }, [handleFiles])

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5" />
    }
    if (file.type === 'application/pdf') {
      return <FileText className="h-5 w-5" />
    }
    return <File className="h-5 w-5" />
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const removeUploadingFile = (file: File) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== file))
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="p-8 text-center">
          <Upload className={cn(
            "mx-auto h-12 w-12 mb-4",
            isDragging ? "text-primary" : "text-muted-foreground"
          )} />
          <div className="mb-2 text-sm font-medium">
            Drag and drop files here, or click to browse
          </div>
          <div className="text-xs text-muted-foreground mb-4">
            Supports images, PDFs, AI, PSD, EPS, SVG (max {maxSizeMB}MB per file)
          </div>
          <input
            type="file"
            id="file-upload"
            className="hidden"
            multiple
            accept={acceptedTypes.join(',')}
            onChange={handleFileInput}
          />
          <Button asChild variant="outline" size="sm">
            <label htmlFor="file-upload" className="cursor-pointer">
              Browse Files
            </label>
          </Button>
        </div>
      </Card>

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Uploading {uploadingFiles.length} {uploadingFiles.length === 1 ? 'file' : 'files'}...</div>
          {uploadingFiles.map((upload, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 text-muted-foreground">
                  {upload.error ? (
                    <X className="h-5 w-5 text-destructive" />
                  ) : upload.progress === 100 ? (
                    <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
                      ✓
                    </div>
                  ) : (
                    getFileIcon(upload.file)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-medium text-sm truncate">{upload.file.name}</div>
                    <div className="text-xs text-muted-foreground flex-shrink-0">
                      {formatFileSize(upload.file.size)}
                    </div>
                  </div>
                  {upload.error ? (
                    <div className="text-xs text-destructive">{upload.error}</div>
                  ) : upload.progress === 100 ? (
                    <div className="text-xs text-green-600">Upload complete</div>
                  ) : (
                    <div className="space-y-1">
                      <Progress value={upload.progress} className="h-1" />
                      <div className="text-xs text-muted-foreground">Uploading...</div>
                    </div>
                  )}
                </div>
                {upload.error && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => removeUploadingFile(upload.file)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
