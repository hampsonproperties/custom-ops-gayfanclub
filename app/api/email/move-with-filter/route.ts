import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { moveWithFilterBody } from '@/lib/api/schemas'
import { logger } from '@/lib/logger'

const log = logger('email-move-with-filter')


/**
 * Move email(s) to a category and create a filter
 * Automatically applies the filter to ALL matching emails from the same sender
 */
export async function POST(request: NextRequest) {
  try {
    const bodyResult = validateBody(await request.json(), moveWithFilterBody)
    if (bodyResult.error) return bodyResult.error
    const { fromEmail, category, createFilter } = bodyResult.data

    const supabase = await createClient()

    // 1. Create filter if requested
    if (createFilter) {
      const domain = fromEmail.split('@')[1]

      const { error: filterError } = await supabase
        .from('email_filters')
        .insert({
          sender_email: fromEmail,
          sender_domain: domain,
          category,
          notes: `Auto-created on ${new Date().toLocaleDateString()}`,
        })

      if (filterError) {
        log.error('Failed to create filter', { error: filterError })
        // Continue anyway - we can still move the emails
      } else {
        log.info('Created filter', { fromEmail, category })
      }
    }

    // 2. Move ALL emails from this sender to the new category
    const { data: updatedEmails, error: updateError } = await supabase
      .from('communications')
      .update({ category })
      .eq('from_email', fromEmail)
      .eq('direction', 'inbound')
      .select()

    if (updateError) {
      log.error('Failed to update emails', { error: updateError })
      return NextResponse.json(
        { error: 'Failed to update emails', details: updateError.message },
        { status: 500 }
      )
    }

    const count = updatedEmails?.length || 0
    log.info('Moved emails', { count, fromEmail, category })

    return NextResponse.json({
      success: true,
      movedCount: count,
      category,
      fromEmail,
    })
  } catch (error) {
    log.error('Error in move-with-filter', { error })
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
