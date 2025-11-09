import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAgent, runCEOSynthesisAgent, type AgentContext } from '@/lib/openai/agents'
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

    // Get all agents (excluding CEO/CPO for now)
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

    // Get CEO/CPO agent
    const { data: ceoAgent } = await supabase
      .from('agents')
      .select('*')
      .eq('project_id', projectId)
      .eq('type', 'ceo_cpo')
      .single()

    if (!ceoAgent) {
      return NextResponse.json(
        { error: 'CEO/CPO agent not configured' },
        { status: 400 }
      )
    }

    // Step 1: Data Refresh
    const { data: dataSources } = await supabase
      .from('data_sources')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'connected')

    const refreshedData: any = {}
    
    if (dataSources && dataSources.length > 0) {
      for (const dataSource of dataSources) {
        try {
          if (dataSource.type === 'notion' && dataSource.oauth_token) {
            const notionClient = createNotionClient(dataSource.oauth_token)
            const [pages, databases] = await Promise.all([
              fetchNotionPages(notionClient).catch(() => []),
              fetchNotionDatabases(notionClient).catch(() => []),
            ])
            refreshedData.notion = {
              pages: pages.slice(0, 20), // Limit for context
              databases: databases.slice(0, 20),
            }
          }
        } catch (error) {
          console.error(`Error refreshing ${dataSource.type}:`, error)
        }
      }
    }

    // Step 2: Create agent run for analysis
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

    // Step 3: Run all agents in parallel (except CEO/CPO)
    const agentContext: AgentContext = {
      projectName: project.name,
      projectDescription: project.description,
      refreshedData,
    }

    const agentOutputs = await Promise.all(
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
            },
          })

          return {
            agent_id: agent.id,
            agent_name: agent.name,
            output,
          }
        } catch (error: any) {
          console.error(`Error running agent ${agent.id}:`, error)
          return {
            agent_id: agent.id,
            agent_name: agent.name,
            output: `Error: ${error.message}`,
            error: true,
          }
        }
      })
    )

    // Step 4: Get previous rejection reasons for learning
    const { data: previousRejections } = await supabase
      .from('action_rejections')
      .select('rejection_reason')
      .order('created_at', { ascending: false })
      .limit(10)

    const rejectionReasons = previousRejections?.map((r) => r.rejection_reason) || []

    // Step 5: Run CEO/CPO synthesis agent
    const { data: synthesisRun, error: synthesisRunError } = await supabase
      .from('agent_runs')
      .insert({
        project_id: projectId,
        run_type: 'final_synthesis',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (synthesisRunError) {
      return NextResponse.json({ error: synthesisRunError.message }, { status: 500 })
    }

    try {
      const ceoContext: AgentContext = {
        ...agentContext,
        previousRejections: rejectionReasons,
      }

      const proposedActions = await runCEOSynthesisAgent(
        ceoAgent.system_prompt,
        ceoContext,
        agentOutputs.map((ao) => ({
          agent_name: ao.agent_name,
          output: ao.output,
        }))
      )

      // Store CEO/CPO agent output
      await supabase.from('agent_outputs').insert({
        agent_run_id: synthesisRun.id,
        agent_id: ceoAgent.id,
        output_text: JSON.stringify(proposedActions, null, 2),
        metadata: {
          agent_name: ceoAgent.name,
          agent_type: ceoAgent.type,
          proposed_actions_count: proposedActions.length,
        },
      })

      // Store proposed actions
      const { data: insertedActions, error: actionsError } = await supabase
        .from('proposed_actions')
        .insert(
          proposedActions.map((action) => ({
            project_id: projectId,
            title: action.title,
            description: action.description,
            justification: action.justification,
            status: 'pending',
          }))
        )
        .select()

      if (actionsError) {
        console.error('Error storing proposed actions:', actionsError)
      }

      // Update synthesis run status
      await supabase
        .from('agent_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', synthesisRun.id)

      // Update analysis run status
      await supabase
        .from('agent_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', agentRun.id)

      return NextResponse.json({
        success: true,
        agent_run_id: agentRun.id,
        synthesis_run_id: synthesisRun.id,
        agent_outputs: agentOutputs.length,
        proposed_actions: insertedActions?.length || proposedActions.length,
      })
    } catch (error: any) {
      console.error('Error in CEO synthesis:', error)
      
      // Update synthesis run status to failed
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message,
        })
        .eq('id', synthesisRun.id)

      return NextResponse.json(
        { error: `CEO synthesis failed: ${error.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

