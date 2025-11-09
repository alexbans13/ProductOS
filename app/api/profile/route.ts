import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user metadata
    const { data: { user: fullUser } } = await supabase.auth.getUser()

    return NextResponse.json({
      profile: {
        id: user.id,
        email: user.email,
        name: fullUser?.user_metadata?.name || null,
        bio: fullUser?.user_metadata?.bio || null,
        avatar_url: fullUser?.user_metadata?.avatar_url || null,
        created_at: user.created_at,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, bio } = body

    const updateData: { name?: string; bio?: string } = {}
    if (name !== undefined) updateData.name = name
    if (bio !== undefined) updateData.bio = bio

    // Update user metadata
    const { data, error } = await supabase.auth.updateUser({
      data: updateData,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      profile: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || null,
        bio: data.user.user_metadata?.bio || null,
        avatar_url: data.user.user_metadata?.avatar_url || null,
        created_at: data.user.created_at,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

