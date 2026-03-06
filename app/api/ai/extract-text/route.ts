import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { logger } from '@/lib/logger'
import { serverError, badRequest } from '@/lib/api/errors'

const log = logger('ai-extract-text')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return badRequest('No file provided')
    }

    if (file.type !== 'application/pdf') {
      return badRequest('Only PDF files are supported for text extraction')
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()

    return NextResponse.json({ success: true, text: result.text })
  } catch (error) {
    log.error('PDF text extraction error', { error })
    return serverError(error instanceof Error ? error.message : 'Failed to extract text')
  }
}
