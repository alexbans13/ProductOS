import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!agentId) {
      return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
    }

    // Verify agent belongs to user's project
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('project_id')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', agent.project_id)
      .eq('user_id', user.id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get agent outputs
    const { data: outputs, error: outputsError } = await supabase
      .from('agent_outputs')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (outputsError) {
      return NextResponse.json({ error: outputsError.message }, { status: 500 })
    }

    return NextResponse.json({ outputs: outputs || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

