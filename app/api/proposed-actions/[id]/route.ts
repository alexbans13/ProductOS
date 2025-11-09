import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
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

    const { data: action, error } = await supabase
      .from('proposed_actions')
      .select('*, projects!inner(user_id)')
      .eq('id', id)
      .single()

    if (error || !action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    const project = action.projects as any
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get action tracking if exists
    const { data: tracking } = await supabase
      .from('action_tracking')
      .select('*')
      .eq('proposed_action_id', id)
      .single()

    // Get rejection if exists
    const { data: rejection } = await supabase
      .from('action_rejections')
      .select('*')
      .eq('proposed_action_id', id)
      .single()

    const { projects, ...actionData } = action as any

    return NextResponse.json({
      action: actionData,
      tracking,
      rejection,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

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
    const { status, rejection_reason } = body

    // Verify action belongs to user's project
    const { data: action } = await supabase
      .from('proposed_actions')
      .select('*, projects!inner(user_id)')
      .eq('id', id)
      .single()

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 })
    }

    const project = action.projects as any
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (status === 'rejected') {
      if (!rejection_reason) {
        return NextResponse.json(
          { error: 'rejection_reason is required when rejecting' },
          { status: 400 }
        )
      }

      // Update action status
      await supabase
        .from('proposed_actions')
        .update({ status: 'rejected' })
        .eq('id', id)

      // Create rejection record
      await supabase.from('action_rejections').insert({
        proposed_action_id: id,
        rejection_reason,
      })
    } else if (status === 'accepted') {
      // Update action status
      await supabase
        .from('proposed_actions')
        .update({ status: 'accepted' })
        .eq('id', id)

      // Create action tracking record
      const { data: existingTracking } = await supabase
        .from('action_tracking')
        .select('id')
        .eq('proposed_action_id', id)
        .single()

      if (!existingTracking) {
        await supabase.from('action_tracking').insert({
          proposed_action_id: id,
          status: 'active',
        })
      }
    }

    const { data: updatedAction } = await supabase
      .from('proposed_actions')
      .select('*')
      .eq('id', id)
      .single()

    return NextResponse.json({ action: updatedAction })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

