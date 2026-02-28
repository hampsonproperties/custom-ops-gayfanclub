import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { status, note } = body

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    // Get current project to know customer_id
    const { data: project, error: projectError } = await supabase
      .from('work_items')
      .select('id, status, customer_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const oldStatus = project.status

    // Update project status
    const { error: updateError } = await supabase
      .from('work_items')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)

    if (updateError) {
      console.error('Error updating project status:', updateError)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    // Create activity log entry for status change
    const activityMetadata: any = {
      old_status: oldStatus,
      new_status: status
    }

    if (note) {
      activityMetadata.note = note
    }

    const { error: activityError } = await supabase
      .from('activity_logs')
      .insert({
        activity_type: 'status_changed',
        related_entity_type: 'work_item',
        related_entity_id: projectId,
        customer_id: project.customer_id,
        user_id: user.id,
        metadata: activityMetadata
      })

    if (activityError) {
      console.error('Error creating activity log:', activityError)
      // Don't fail the request if activity log fails
    }

    // If there's a note, also create a note activity
    if (note) {
      await supabase
        .from('activity_logs')
        .insert({
          activity_type: 'note_added',
          related_entity_type: 'work_item',
          related_entity_id: projectId,
          customer_id: project.customer_id,
          user_id: user.id,
          metadata: {
            note,
            context: 'status_update'
          }
        })
    }

    return NextResponse.json({
      success: true,
      status
    })

  } catch (error: any) {
    console.error('Status update error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}
