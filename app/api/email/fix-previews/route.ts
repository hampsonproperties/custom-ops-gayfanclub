import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { htmlToPlainText } from '@/lib/utils/html-entities'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { dryRun = false } = await request.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch all communications with body_preview
    const { data: communications, error: fetchError } = await supabase
      .from('communications')
      .select('id, body_preview, body_html')
      .not('body_preview', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    if (!communications || communications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails found to fix',
        fixed: 0,
        skipped: 0,
      })
    }

    let fixed = 0
    let skipped = 0
    const updates: Array<{ id: string; old: string; new: string }> = []

    for (const comm of communications) {
      const oldPreview = comm.body_preview || ''

      // Re-generate clean preview from body_html if available
      let newPreview: string
      if (comm.body_html) {
        newPreview = htmlToPlainText(comm.body_html).substring(0, 200)
      } else {
        // If no body_html, just decode the existing preview
        newPreview = htmlToPlainText(oldPreview)
      }

      // Only update if different
      if (newPreview !== oldPreview) {
        updates.push({
          id: comm.id,
          old: oldPreview.substring(0, 50),
          new: newPreview.substring(0, 50),
        })

        if (!dryRun) {
          const { error: updateError } = await supabase
            .from('communications')
            .update({ body_preview: newPreview })
            .eq('id', comm.id)

          if (updateError) {
            console.error(`Failed to update ${comm.id}:`, updateError)
            continue
          }
        }

        fixed++
      } else {
        skipped++
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      total: communications.length,
      fixed,
      skipped,
      samples: updates.slice(0, 5), // Show first 5 examples
    })
  } catch (error) {
    console.error('Fix previews error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fix previews' },
      { status: 500 }
    )
  }
}
