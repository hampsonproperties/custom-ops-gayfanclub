'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Download, Maximize2, X, FileText, File } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileItem {
  id: string
  original_filename: string
  external_url?: string | null
  storage_bucket?: string | null
  storage_path?: string | null
  mime_type?: string
  size_bytes?: number
  kind?: string
  source?: string | null
  note?: string | null
}

function getSourceLabel(file: FileItem): { text: string; color: string } | null {
  if (file.source === 'customify_api') return { text: 'Customify', color: 'bg-purple-100 text-purple-700' }
  if (file.source === 'shopify_property') return { text: 'Shopify Import', color: 'bg-blue-100 text-blue-700' }
  if (file.source === 'manual_upload') return { text: 'Uploaded', color: 'bg-green-100 text-green-700' }
  if (file.source === 'email_attachment') return { text: 'Email', color: 'bg-amber-100 text-amber-700' }
  // Infer from data if source column not yet populated
  if (file.storage_bucket === 'customify') return { text: 'Customify', color: 'bg-purple-100 text-purple-700' }
  return null
}

function getFileUrl(file: FileItem): string | null {
  if (file.external_url) return file.external_url
  if (file.storage_bucket && file.storage_path) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    return `${supabaseUrl}/storage/v1/object/public/${file.storage_bucket}/${file.storage_path}`
  }
  return null
}

interface FileGalleryProps {
  files: FileItem[]
  className?: string
}

export function FileGallery({ files, className }: FileGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')

  // Only include files with a resolvable URL
  const resolvedFiles = files.filter(f => getFileUrl(f))

  // Separate images from other files
  const imageFiles = resolvedFiles.filter(f =>
    f.mime_type?.startsWith('image/') ||
    f.kind === 'image' ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.original_filename)
  )

  const otherFiles = resolvedFiles.filter(f =>
    !f.mime_type?.startsWith('image/') &&
    f.kind !== 'image' &&
    !/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.original_filename)
  )

  const handleImageClick = (url: string, filename: string) => {
    setSelectedImage(url)
    setSelectedFileName(filename)
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No files uploaded yet</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Image Gallery */}
      {imageFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            Images ({imageFiles.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {imageFiles.map((file) => (
              <Card
                key={file.id}
                className="group relative aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                onClick={() => handleImageClick(getFileUrl(file)!, file.original_filename)}
              >
                <Image
                  src={getFileUrl(file)!}
                  alt={file.original_filename}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  unoptimized // Since these are external URLs
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Maximize2 className="h-6 w-6 text-white" />
                </div>
                {/* Source badge */}
                {getSourceLabel(file) && (
                  <div className="absolute top-1.5 left-1.5">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", getSourceLabel(file)!.color)}>
                      {getSourceLabel(file)!.text}
                    </span>
                  </div>
                )}
                {/* Kind badge */}
                {file.kind && (
                  <div className="absolute top-1.5 right-1.5">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-black/60 text-white">
                      {file.kind === 'design' ? 'Customer Design' : file.kind === 'preview' ? 'Mockup' : file.kind}
                    </span>
                  </div>
                )}
                {/* Filename overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{file.note || file.original_filename}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Other Files List */}
      {otherFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-3">
            Files ({otherFiles.length})
          </h3>
          <div className="space-y-2">
            {otherFiles.map((file) => (
              <Card key={file.id} className="p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <File className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.note || file.original_filename}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {getSourceLabel(file) && (
                          <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium", getSourceLabel(file)!.color)}>
                            {getSourceLabel(file)!.text}
                          </span>
                        )}
                        {file.mime_type && <span>{file.mime_type}</span>}
                        {file.mime_type && file.size_bytes && <span>•</span>}
                        {file.size_bytes && <span>{formatBytes(file.size_bytes)}</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    asChild
                  >
                    <a
                      href={getFileUrl(file)!}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-5xl w-full h-[90vh] p-0 bg-black/95">
          {selectedImage && (
            <div className="relative w-full h-full flex flex-col">
              {/* Header with filename */}
              <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
                <p className="text-white text-sm font-medium truncate pr-12">
                  {selectedFileName}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                    asChild
                  >
                    <a href={selectedImage} download target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Image container */}
              <div className="relative w-full h-full flex items-center justify-center p-4">
                <div className="relative max-w-full max-h-full">
                  <Image
                    src={selectedImage}
                    alt={selectedFileName}
                    width={1200}
                    height={800}
                    className="object-contain w-auto h-auto max-w-full max-h-[85vh]"
                    unoptimized
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
