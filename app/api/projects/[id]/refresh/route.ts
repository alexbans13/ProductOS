import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all connected data sources
    const { data: dataSources, error: dataSourcesError } = await supabase
      .from('data_sources')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'connected')

    if (dataSourcesError) {
      return NextResponse.json({ error: dataSourcesError.message }, { status: 500 })
    }

    if (!dataSources || dataSources.length === 0) {
      return NextResponse.json(
        { error: 'No connected data sources found' },
        { status: 400 }
      )
    }

    // Create agent run for data refresh
    const { data: agentRun, error: runError } = await supabase
      .from('agent_runs')
      .insert({
        project_id: projectId,
        run_type: 'data_refresh',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (runError) {
      return NextResponse.json({ error: runError.message }, { status: 500 })
    }

    // Refresh data from all sources
    const refreshResults: any[] = []
    const errors: string[] = []

    for (const dataSource of dataSources) {
      try {
        if (dataSource.type === 'notion' && dataSource.oauth_token) {
          const notionClient = createNotionClient(dataSource.oauth_token)
          
          // Fetch pages and databases
          const [pages, databases] = await Promise.all([
            fetchNotionPages(notionClient).catch(() => []),
            fetchNotionDatabases(notionClient).catch(() => []),
          ])

          refreshResults.push({
            data_source_id: dataSource.id,
            type: 'notion',
            pages_count: pages.length,
            databases_count: databases.length,
            data: {
              pages: pages.slice(0, 10), // Limit to first 10 for storage
              databases: databases.slice(0, 10),
            },
          })
        }
        // Add other data source types here (JIRA, Slack, etc.)
      } catch (error: any) {
        errors.push(`Error refreshing ${dataSource.type}: ${error.message}`)
        console.error(`Error refreshing data source ${dataSource.id}:`, error)
      }
    }

    // Update agent run status
    const { error: updateError } = await supabase
      .from('agent_runs')
      .update({
        status: errors.length > 0 ? 'failed' : 'completed',
        completed_at: new Date().toISOString(),
        error_message: errors.length > 0 ? errors.join('; ') : null,
      })
      .eq('id', agentRun.id)

    if (updateError) {
      console.error('Error updating agent run:', updateError)
    }

    // Store refresh results (you might want to store this in a separate table or Supabase Storage)
    // For now, we'll just return the results

    return NextResponse.json({
      success: true,
      agent_run_id: agentRun.id,
      refresh_results: refreshResults,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

