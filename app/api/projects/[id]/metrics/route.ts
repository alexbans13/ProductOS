import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
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

    // Get all proposed actions
    const { data: actions } = await supabase
      .from('proposed_actions')
      .select('id, status')
      .eq('project_id', projectId)

    // Calculate approval/rejection rates
    const totalActions = actions?.length || 0
    const acceptedActions = actions?.filter((a) => a.status === 'accepted').length || 0
    const rejectedActions = actions?.filter((a) => a.status === 'rejected').length || 0
    const pendingActions = actions?.filter((a) => a.status === 'pending').length || 0

    const approvalRate = totalActions > 0 ? (acceptedActions / totalActions) * 100 : 0
    const rejectionRate = totalActions > 0 ? (rejectedActions / totalActions) * 100 : 0

    // Get action tracking data for success scores
    const { data: tracking } = await supabase
      .from('action_tracking')
      .select('success_score, status')
      .in(
        'proposed_action_id',
        actions?.map((a) => a.id) || []
      )

    // Calculate success score distribution
    const successScores = tracking
      ?.filter((t) => t.success_score !== null)
      .map((t) => t.success_score) || []

    const scoreDistribution = {
      '-5': successScores.filter((s) => s === -5).length,
      '-4': successScores.filter((s) => s === -4).length,
      '-3': successScores.filter((s) => s === -3).length,
      '-2': successScores.filter((s) => s === -2).length,
      '-1': successScores.filter((s) => s === -1).length,
      '0': successScores.filter((s) => s === 0).length,
      '1': successScores.filter((s) => s === 1).length,
      '2': successScores.filter((s) => s === 2).length,
      '3': successScores.filter((s) => s === 3).length,
      '4': successScores.filter((s) => s === 4).length,
      '5': successScores.filter((s) => s === 5).length,
    }

    const averageSuccessScore =
      successScores.length > 0
        ? successScores.reduce((a, b) => a + b, 0) / successScores.length
        : null

    const completedActions = tracking?.filter((t) => t.status === 'completed').length || 0
    const activeActions = tracking?.filter((t) => t.status === 'active').length || 0

    // Get agent performance data
    const { data: agentOutputs } = await supabase
      .from('agent_outputs')
      .select('agent_id, agents!inner(name, type)')
      .in(
        'agent_run_id',
        (
          await supabase
            .from('agent_runs')
            .select('id')
            .eq('project_id', projectId)
            .eq('run_type', 'agent_analysis')
        ).data?.map((r) => r.id) || []
      )

    // Count outputs per agent
    const agentPerformance: Record<string, { name: string; type: string; count: number }> = {}
    agentOutputs?.forEach((output) => {
      const agent = output.agents as any
      const agentId = output.agent_id
      if (!agentPerformance[agentId]) {
        agentPerformance[agentId] = {
          name: agent.name,
          type: agent.type,
          count: 0,
        }
      }
      agentPerformance[agentId].count++
    })

    // Get rejection reasons for insights
    const { data: rejections } = await supabase
      .from('action_rejections')
      .select('rejection_reason, created_at')
      .in(
        'proposed_action_id',
        actions?.map((a) => a.id) || []
      )
      .order('created_at', { ascending: false })
      .limit(10)

    // Get recent agent runs
    const { data: recentRuns } = await supabase
      .from('agent_runs')
      .select('id, run_type, status, started_at, completed_at')
      .eq('project_id', projectId)
      .order('started_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      metrics: {
        actions: {
          total: totalActions,
          accepted: acceptedActions,
          rejected: rejectedActions,
          pending: pendingActions,
          approval_rate: Math.round(approvalRate * 100) / 100,
          rejection_rate: Math.round(rejectionRate * 100) / 100,
        },
        success_scores: {
          distribution: scoreDistribution,
          average: averageSuccessScore ? Math.round(averageSuccessScore * 100) / 100 : null,
          total_scored: successScores.length,
        },
        tracking: {
          completed: completedActions,
          active: activeActions,
        },
        agent_performance: Object.values(agentPerformance),
        recent_rejections: rejections || [],
        recent_runs: recentRuns || [],
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

