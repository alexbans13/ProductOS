import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('avatar') as File

    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be less than 5MB' }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const fileName = `${user.id}-${Date.now()}.${file.name.split('.').pop()}`
    const filePath = fileName

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      // If bucket doesn't exist, create it
      if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket')) {
        return NextResponse.json(
          { error: 'Storage bucket not configured. Please create an "avatars" bucket in Supabase Storage with public access.' },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    // Update user metadata with avatar URL
    const { data: updatedUser, error: updateError } = await supabase.auth.updateUser({
      data: { avatar_url: publicUrl },
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      profile: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        name: updatedUser.user.user_metadata?.name || null,
        bio: updatedUser.user.user_metadata?.bio || null,
        avatar_url: publicUrl,
        created_at: updatedUser.user.created_at,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

