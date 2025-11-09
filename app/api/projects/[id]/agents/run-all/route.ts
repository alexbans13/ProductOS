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
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all agents (excluding CEO/CPO)
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select('*')
      .eq('project_id', projectId)
      .neq('type', 'ceo_cpo')
      .order('created_at', { ascending: true })

    if (agentsError) {
      return NextResponse.json({ error: agentsError.message }, { status: 500 })
    }

    if (!agents || agents.length === 0) {
      return NextResponse.json(
        { error: 'No agents configured for this project' },
        { status: 400 }
      )
    }

    // Get connected data sources and refresh data
    const { data: dataSources } = await supabase
      .from('data_sources')
      .select('*')
      .eq('project_id', projectId)
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
        project_id: projectId,
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

    // Build input message
    const inputMessage = `Project: ${project.name}\n${
      project.description ? `Description: ${project.description}\n\n` : ''
    }Refreshed Data:\n${JSON.stringify(refreshedData, null, 2)}\n\nPlease analyze this data and provide your insights and recommendations.`

    // Run all agents in parallel
    const results = await Promise.all(
      agents.map(async (agent) => {
        try {
          const output = await runAgent(agent.system_prompt, agentContext)
          
          // Store agent output
          await supabase.from('agent_outputs').insert({
            agent_run_id: agentRun.id,
            agent_id: agent.id,
            output_text: output,
            metadata: {
              agent_name: agent.name,
              agent_type: agent.type,
              input_message: inputMessage,
            },
          })

          return {
            agent_id: agent.id,
            agent_name: agent.name,
            input_message: inputMessage,
            output,
            error: null,
          }
        } catch (error: any) {
          const errorMessage = error.message || 'Unknown error'
          
          // Store error output
          await supabase.from('agent_outputs').insert({
            agent_run_id: agentRun.id,
            agent_id: agent.id,
            output_text: `Error: ${errorMessage}`,
            metadata: {
              agent_name: agent.name,
              agent_type: agent.type,
              input_message: inputMessage,
              error: errorMessage,
            },
          })

          return {
            agent_id: agent.id,
            agent_name: agent.name,
            input_message: inputMessage,
            output: `Error: ${errorMessage}`,
            error: errorMessage,
          }
        }
      })
    )

    // Update agent run status
    const hasErrors = results.some((r) => r.error !== null)
    await supabase
      .from('agent_runs')
      .update({
        status: hasErrors ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        error_message: hasErrors ? 'Some agents failed' : null,
      })
      .eq('id', agentRun.id)

    return NextResponse.json({
      success: true,
      agent_run_id: agentRun.id,
      results,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

