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
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        new URL(`/projects/${state ? JSON.parse(Buffer.from(state, 'base64').toString()).project_id : ''}?error=notion_auth_failed`, request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?error=notion_auth_missing_params', request.url)
      )
    }

    // Decode state to get project_id
    let projectId: string
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      projectId = stateData.project_id
      
      // Verify user matches
      if (stateData.user_id !== user.id) {
        return NextResponse.redirect(
          new URL('/dashboard?error=notion_auth_unauthorized', request.url)
        )
      }
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard?error=notion_auth_invalid_state', request.url)
      )
    }

    // Exchange code for access token
    const clientId = process.env.NOTION_CLIENT_ID
    const clientSecret = process.env.NOTION_CLIENT_SECRET
    const redirectUri = process.env.NOTION_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/data-sources/notion/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        new URL(`/projects/${projectId}?error=notion_oauth_not_configured`, request.url)
      )
    }

    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Notion token exchange error:', errorData)
      return NextResponse.redirect(
        new URL(`/projects/${projectId}?error=notion_token_exchange_failed`, request.url)
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.redirect(
        new URL('/dashboard?error=project_not_found', request.url)
      )
    }

    // Check if data source already exists for this project and type
    const { data: existingSource } = await supabase
      .from('data_sources')
      .select('id')
      .eq('project_id', projectId)
      .eq('type', 'notion')
      .single()

    if (existingSource) {
      // Update existing data source
      const { error: updateError } = await supabase
        .from('data_sources')
        .update({
          oauth_token: accessToken,
          status: 'connected',
          connected_at: new Date().toISOString(),
        })
        .eq('id', existingSource.id)

      if (updateError) {
        console.error('Error updating data source:', updateError)
        return NextResponse.redirect(
          new URL(`/projects/${projectId}?error=notion_update_failed`, request.url)
        )
      }
    } else {
      // Create new data source
      const { error: insertError } = await supabase
        .from('data_sources')
        .insert({
          project_id: projectId,
          type: 'notion',
          oauth_token: accessToken,
          status: 'connected',
          connected_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error('Error creating data source:', insertError)
        return NextResponse.redirect(
          new URL(`/projects/${projectId}?error=notion_create_failed`, request.url)
        )
      }
    }

    // Redirect back to project page
    return NextResponse.redirect(
      new URL(`/projects/${projectId}?success=notion_connected`, request.url)
    )
  } catch (error: any) {
    console.error('Notion callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard?error=notion_callback_error', request.url)
    )
  }
}

