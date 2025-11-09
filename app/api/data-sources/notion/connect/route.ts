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

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const clientId = process.env.NOTION_CLIENT_ID
    const redirectUri = process.env.NOTION_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/data-sources/notion/callback`
    const state = Buffer.from(JSON.stringify({ project_id: projectId, user_id: user.id })).toString('base64')

    if (!clientId) {
      return NextResponse.json({ error: 'Notion OAuth not configured' }, { status: 500 })
    }

    // Notion OAuth URL
    const notionAuthUrl = new URL('https://api.notion.com/v1/oauth/authorize')
    notionAuthUrl.searchParams.set('client_id', clientId)
    notionAuthUrl.searchParams.set('redirect_uri', redirectUri)
    notionAuthUrl.searchParams.set('response_type', 'code')
    notionAuthUrl.searchParams.set('owner', 'user')
    notionAuthUrl.searchParams.set('state', state)

    return NextResponse.redirect(notionAuthUrl.toString())
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

