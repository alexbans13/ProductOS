import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, comments, success_score } = body

    // Verify action tracking belongs to user's project
    const { data: tracking } = await supabase
      .from('action_tracking')
      .select('*, proposed_actions!inner(projects!inner(user_id))')
      .eq('id', id)
      .single()

    if (!tracking) {
      return NextResponse.json({ error: 'Action tracking not found' }, { status: 404 })
    }

    const action = tracking.proposed_actions as any
    const project = action.projects as any
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const updateData: {
      status?: string
      comments?: string | null
      success_score?: number | null
      completed_at?: string | null
    } = {}

    if (status !== undefined) updateData.status = status
    if (comments !== undefined) updateData.comments = comments
    if (success_score !== undefined) {
      updateData.success_score = success_score
      if (success_score !== null && status === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }
    }
    if (status === 'completed' && !updateData.completed_at) {
      updateData.completed_at = new Date().toISOString()
    }

    const { data: updatedTracking, error } = await supabase
      .from('action_tracking')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ tracking: updatedTracking })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

