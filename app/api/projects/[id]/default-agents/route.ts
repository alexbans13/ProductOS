import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { defaultAgents } from '@/lib/agents/default-agents'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: projectId } = await params
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if default agents already exist
    const { data: existingAgents } = await supabase
      .from('agents')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_default', true)

    if (existingAgents && existingAgents.length > 0) {
      return NextResponse.json(
        { error: 'Default agents already exist for this project' },
        { status: 400 }
      )
    }

    // Create default agents
    const agentsToInsert = defaultAgents.map((agent) => ({
      project_id: projectId,
      name: agent.name,
      type: agent.type,
      system_prompt: agent.system_prompt,
      is_default: true,
    }))

    const { data: agents, error } = await supabase
      .from('agents')
      .insert(agentsToInsert)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ agents }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

