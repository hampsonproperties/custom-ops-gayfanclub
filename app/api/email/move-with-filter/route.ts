import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Move email(s) to a category and create a filter
 * Automatically applies the filter to ALL matching emails from the same sender
 */
export async function POST(request: NextRequest) {
  try {
    const { fromEmail, category, createFilter } = await request.json()

    if (!fromEmail || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: fromEmail, category' },
        { status: 400 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
        console.error('Failed to create filter:', filterError)
        // Continue anyway - we can still move the emails
      } else {
        console.log(`Created filter for ${fromEmail} → ${category}`)
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
      console.error('Failed to update emails:', updateError)
      return NextResponse.json(
        { error: 'Failed to update emails', details: updateError.message },
        { status: 500 }
      )
    }

    const count = updatedEmails?.length || 0
    console.log(`Moved ${count} email(s) from ${fromEmail} to ${category}`)

    return NextResponse.json({
      success: true,
      movedCount: count,
      category,
      fromEmail,
    })
  } catch (error) {
    console.error('Error in move-with-filter:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    )
  }
}
