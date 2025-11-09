import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgent, type AgentContext } from '@/lib/openai/agents'
import { createNotionClient, fetchNotionPages, fetchNotionDatabases } from '@/lib/notion/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: agentId } = await params
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*, projects!inner(user_id, name, description)')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const project = agent.projects as any
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get connected data sources and refresh data
    const { data: dataSources } = await supabase
      .from('data_sources')
      .select('*')
      .eq('project_id', agent.project_id)
      .eq('status', 'connected')

    const refreshedData: any = {}
    
    // Parallelize data source refresh
    if (dataSources && dataSources.length > 0) {
      const refreshPromises = dataSources.map(async (dataSource) => {
        try {
          if (dataSource.type === 'notion' && dataSource.oauth_token) {
            const notionClient = createNotionClient(dataSource.oauth_token)
            const [pages, databases] = await Promise.all([
              fetchNotionPages(notionClient).catch(() => []),
              fetchNotionDatabases(notionClient).catch(() => []),
            ])
            return {
              type: 'notion',
              data: {
                pages: pages.slice(0, 20),
                databases: databases.slice(0, 20),
              }
            }
          }
          return null
        } catch (error) {
          console.error(`Error refreshing ${dataSource.type}:`, error)
          return null
        }
      })

      const refreshResults = await Promise.all(refreshPromises)
      refreshResults.forEach((result) => {
        if (result) {
          refreshedData[result.type] = result.data
        }
      })
    }

    // Create agent run
    const { data: agentRun, error: runError } = await supabase
      .from('agent_runs')
      .insert({
        project_id: agent.project_id,
        run_type: 'agent_analysis',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 })
    }

    // Prepare agent context
    const agentContext: AgentContext = {
      projectName: project.name,
      projectDescription: project.description,
      refreshedData,
    }

    // Build the input message
    const inputMessage = `Project: ${project.name}\n${
      project.description ? `Description: ${project.description}\n\n` : ''
    }Refreshed Data:\n${JSON.stringify(refreshedData, null, 2)}\n\nPlease analyze this data and provide your insights and recommendations.`

    // Run the agent
    let output: string
    let error: string | null = null

    try {
      output = await runAgent(agent.system_prompt, agentContext)
    } catch (err: any) {
      output = `Error: ${err.message}`
      error = err.message
    }

    // Store agent output
    const { data: agentOutput, error: outputError } = await supabase
      .from('agent_outputs')
      .insert({
        agent_run_id: agentRun.id,
        agent_id: agentId,
        output_text: output,
        metadata: {
          agent_name: agent.name,
          agent_type: agent.type,
          input_message: inputMessage,
          error: error,
        },
      })
      .select()
      .single()

    if (outputError) {
      console.error('Error storing agent output:', outputError)
    }

    // Update agent run status
    await supabase
      .from('agent_runs')
      .update({
        status: error ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        error_message: error,
      })
      .eq('id', agentRun.id)

    return NextResponse.json({
      success: true,
      agent_run_id: agentRun.id,
      agent_output_id: agentOutput?.id,
      input_message: inputMessage,
      output,
      error,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

