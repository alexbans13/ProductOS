'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

interface DataSource {
  id: string
  type: string
  status: string
  connected_at: string | null
  created_at: string
}

interface Agent {
  id: string
  name: string
  type: string
  system_prompt: string
  is_default: boolean
  created_at: string
  updated_at: string
}

type Tab = 'overview' | 'data-sources' | 'agents' | 'actions' | 'metrics'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [loadingDataSources, setLoadingDataSources] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showCreateDefaultAgents, setShowCreateDefaultAgents] = useState(false)
  const [creatingDefaultAgents, setCreatingDefaultAgents] = useState(false)
  const [proposedActions, setProposedActions] = useState<any[]>([])
  const [loadingActions, setLoadingActions] = useState(false)
  const [runningAgents, setRunningAgents] = useState(false)
  const [showRejectionModal, setShowRejectionModal] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionTracking, setActionTracking] = useState<Record<string, any>>({})
  const [editingTracking, setEditingTracking] = useState<string | null>(null)
  const [trackingComments, setTrackingComments] = useState<Record<string, string>>({})
  const [trackingScore, setTrackingScore] = useState<Record<string, number | null>>({})
  const [metrics, setMetrics] = useState<any>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadProject()
  }, [projectId])

  useEffect(() => {
    if (activeTab === 'data-sources') {
      loadDataSources()
    } else if (activeTab === 'agents') {
      loadAgents()
    } else if (activeTab === 'actions') {
      loadProposedActions()
    } else if (activeTab === 'metrics') {
      loadMetrics()
    }
  }, [activeTab, projectId])

  useEffect(() => {
    // Check for success/error messages in URL params
    const searchParams = new URLSearchParams(window.location.search)
    const success = searchParams.get('success')
    const error = searchParams.get('error')

    if (success === 'notion_connected') {
      setMessage({ type: 'success', text: 'Notion connected successfully!' })
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
      // Reload data sources
      loadDataSources()
    } else if (error) {
      const errorMessages: Record<string, string> = {
        notion_auth_failed: 'Notion authentication failed. Please try again.',
        notion_oauth_not_configured: 'Notion OAuth is not configured. Please check your environment variables.',
        notion_token_exchange_failed: 'Failed to exchange Notion token. Please try again.',
        notion_create_failed: 'Failed to create Notion connection. Please try again.',
        notion_update_failed: 'Failed to update Notion connection. Please try again.',
      }
      setMessage({
        type: 'error',
        text: errorMessages[error] || 'An error occurred. Please try again.',
      })
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const loadProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/dashboard')
          return
        }
        throw new Error('Failed to load project')
      }
      const data = await response.json()
      setProject(data.project)
    } catch (error) {
      console.error('Error loading project:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadDataSources = async () => {
    setLoadingDataSources(true)
    try {
      const response = await fetch(`/api/data-sources?project_id=${projectId}`)
      if (!response.ok) throw new Error('Failed to load data sources')
      const data = await response.json()
      setDataSources(data.dataSources || [])
    } catch (error) {
      console.error('Error loading data sources:', error)
    } finally {
      setLoadingDataSources(false)
    }
  }

  const handleConnectNotion = () => {
    window.location.href = `/api/data-sources/notion/connect?project_id=${projectId}`
  }

  const handleDisconnect = async (dataSourceId: string) => {
    if (!confirm('Are you sure you want to disconnect this data source?')) {
      return
    }

    setDisconnectingId(dataSourceId)
    try {
      const response = await fetch(`/api/data-sources/${dataSourceId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to disconnect data source')

      setDataSources(dataSources.filter((ds) => ds.id !== dataSourceId))
    } catch (error) {
      console.error('Error disconnecting data source:', error)
      alert('Failed to disconnect data source. Please try again.')
    } finally {
      setDisconnectingId(null)
    }
  }

  const loadAgents = async () => {
    setLoadingAgents(true)
    try {
      const response = await fetch(`/api/agents?project_id=${projectId}`)
      if (!response.ok) throw new Error('Failed to load agents')
      const data = await response.json()
      setAgents(data.agents || [])
      setShowCreateDefaultAgents(data.agents?.length === 0)
    } catch (error) {
      console.error('Error loading agents:', error)
    } finally {
      setLoadingAgents(false)
    }
  }

  const handleCreateDefaultAgents = async () => {
    setCreatingDefaultAgents(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/default-agents`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create default agents')
      }

      const data = await response.json()
      setAgents(data.agents || [])
      setShowCreateDefaultAgents(false)
      setMessage({ type: 'success', text: 'Default agents created successfully!' })
    } catch (error: any) {
      console.error('Error creating default agents:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to create default agents' })
    } finally {
      setCreatingDefaultAgents(false)
    }
  }

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent)
    setShowAgentModal(true)
  }

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) {
      return
    }

    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete agent')
      }

      setAgents(agents.filter((a) => a.id !== agentId))
      setMessage({ type: 'success', text: 'Agent deleted successfully!' })
    } catch (error: any) {
      console.error('Error deleting agent:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to delete agent' })
    }
  }

  const loadProposedActions = async () => {
    setLoadingActions(true)
    try {
      const response = await fetch(`/api/proposed-actions?project_id=${projectId}`)
      if (!response.ok) throw new Error('Failed to load proposed actions')
      const data = await response.json()
      setProposedActions(data.actions || [])

      // Load tracking for accepted actions
      const acceptedActions = (data.actions || []).filter((a: any) => a.status === 'accepted')
      const trackingMap: Record<string, any> = {}
      
      for (const action of acceptedActions) {
        try {
          const trackingResponse = await fetch(`/api/proposed-actions/${action.id}`)
          if (trackingResponse.ok) {
            const trackingData = await trackingResponse.json()
            if (trackingData.tracking) {
              trackingMap[action.id] = trackingData.tracking
              setTrackingComments((prev) => ({
                ...prev,
                [action.id]: trackingData.tracking.comments || '',
              }))
              setTrackingScore((prev) => ({
                ...prev,
                [action.id]: trackingData.tracking.success_score,
              }))
            }
          }
        } catch (error) {
          console.error(`Error loading tracking for action ${action.id}:`, error)
        }
      }
      
      setActionTracking(trackingMap)
    } catch (error) {
      console.error('Error loading proposed actions:', error)
    } finally {
      setLoadingActions(false)
    }
  }

  const handleRunAgents = async () => {
    setRunningAgents(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/run-agents`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to run agents')
      }

      const data = await response.json()
      setMessage({
        type: 'success',
        text: `Agents completed! Generated ${data.proposed_actions} proposed actions.`,
      })
      await loadProposedActions()
    } catch (error: any) {
      console.error('Error running agents:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to run agents' })
    } finally {
      setRunningAgents(false)
    }
  }

  const handleAcceptAction = async (actionId: string) => {
    try {
      const response = await fetch(`/api/proposed-actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'accepted' }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to accept action')
      }

      await loadProposedActions()
      setMessage({ type: 'success', text: 'Action accepted successfully!' })
    } catch (error: any) {
      console.error('Error accepting action:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to accept action' })
    }
  }

  const handleRejectAction = async (actionId: string) => {
    if (!rejectionReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a reason for rejection' })
      return
    }

    try {
      const response = await fetch(`/api/proposed-actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'rejected',
          rejection_reason: rejectionReason,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to reject action')
      }

      await loadProposedActions()
      setShowRejectionModal(null)
      setRejectionReason('')
      setMessage({ type: 'success', text: 'Action rejected successfully!' })
    } catch (error: any) {
      console.error('Error rejecting action:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to reject action' })
    }
  }

  const handleUpdateTracking = async (actionId: string, trackingId: string) => {
    try {
      const response = await fetch(`/api/action-tracking/${trackingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: trackingComments[actionId] || null,
          success_score: trackingScore[actionId] !== undefined ? trackingScore[actionId] : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update tracking')
      }

      await loadProposedActions()
      setEditingTracking(null)
      setMessage({ type: 'success', text: 'Action tracking updated successfully!' })
    } catch (error: any) {
      console.error('Error updating tracking:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to update tracking' })
    }
  }

  const handleCompleteAction = async (actionId: string, trackingId: string) => {
    try {
      const response = await fetch(`/api/action-tracking/${trackingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          comments: trackingComments[actionId] || null,
          success_score: trackingScore[actionId] !== undefined ? trackingScore[actionId] : null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to complete action')
      }

      await loadProposedActions()
      setEditingTracking(null)
      setMessage({ type: 'success', text: 'Action marked as completed!' })
    } catch (error: any) {
      console.error('Error completing action:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to complete action' })
    }
  }

  const loadMetrics = async () => {
    setLoadingMetrics(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/metrics`)
      if (!response.ok) throw new Error('Failed to load metrics')
      const data = await response.json()
      setMetrics(data.metrics)
    } catch (error) {
      console.error('Error loading metrics:', error)
    } finally {
      setLoadingMetrics(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!project) {
    return null
  }

  const tabs = [
    { id: 'overview' as Tab, name: 'Overview' },
    { id: 'data-sources' as Tab, name: 'Data Sources' },
    { id: 'agents' as Tab, name: 'Agents' },
    { id: 'actions' as Tab, name: 'Actions' },
    { id: 'metrics' as Tab, name: 'Metrics' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-2xl font-bold text-gray-900 hover:text-blue-600"
              >
                ProductOS
              </Link>
              <span className="text-gray-400">/</span>
              <span className="text-lg font-semibold text-gray-700">{project.name}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
          {project.description && (
            <p className="mt-2 text-sm text-gray-600">{project.description}</p>
          )}
        </div>

        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium
                  ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }
                `}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {message && (
          <div
            className={`mb-4 rounded-md p-4 ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{message.text}</p>
              <button
                onClick={() => setMessage(null)}
                className="text-sm font-semibold hover:opacity-75"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="mt-8">
          {activeTab === 'overview' && (
            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Overview</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Created</p>
                  <p className="text-sm text-gray-600">
                    {new Date(project.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Last Updated</p>
                  <p className="text-sm text-gray-600">
                    {new Date(project.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data-sources' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Data Sources</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Connect your data sources to enable AI agent analysis
                  </p>
                </div>
                <button
                  onClick={handleConnectNotion}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Connect Notion
                </button>
              </div>

              {loadingDataSources ? (
                <div className="rounded-lg bg-white p-6 shadow-sm text-center">
                  <p className="text-sm text-gray-600">Loading data sources...</p>
                </div>
              ) : dataSources.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <h3 className="text-lg font-semibold text-gray-900">No data sources connected</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Connect your first data source to get started
                  </p>
                  <button
                    onClick={handleConnectNotion}
                    className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                  >
                    Connect Notion
                  </button>
                </div>
              ) : (
                <div className="rounded-lg bg-white shadow-sm overflow-hidden">
                  <ul className="divide-y divide-gray-200">
                    {dataSources.map((dataSource) => (
                      <li key={dataSource.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-600 font-semibold text-sm">
                                  {dataSource.type.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-gray-900 capitalize">
                                {dataSource.type}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {dataSource.status === 'connected' ? (
                                  <span className="inline-flex items-center">
                                    <span className="h-2 w-2 rounded-full bg-green-400 mr-2"></span>
                                    Connected
                                    {dataSource.connected_at && (
                                      <span className="ml-2">
                                        {new Date(dataSource.connected_at).toLocaleDateString()}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center">
                                    <span className="h-2 w-2 rounded-full bg-gray-400 mr-2"></span>
                                    {dataSource.status}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDisconnect(dataSource.id)}
                            disabled={disconnectingId === dataSource.id}
                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {disconnectingId === dataSource.id ? 'Disconnecting...' : 'Disconnect'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">AI Agents</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Configure and manage your AI agents for product analysis
                  </p>
                </div>
                {!showCreateDefaultAgents && (
                  <button
                    onClick={() => {
                      setEditingAgent(null)
                      setShowAgentModal(true)
                    }}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Create Custom Agent
                  </button>
                )}
              </div>

              {showCreateDefaultAgents ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <h3 className="text-lg font-semibold text-gray-900">No agents configured</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Create default agents to get started with AI-powered product analysis
                  </p>
                  <button
                    onClick={handleCreateDefaultAgents}
                    disabled={creatingDefaultAgents}
                    className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingDefaultAgents ? 'Creating...' : 'Create Default Agents'}
                  </button>
                </div>
              ) : loadingAgents ? (
                <div className="rounded-lg bg-white p-6 shadow-sm text-center">
                  <p className="text-sm text-gray-600">Loading agents...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {agent.name}
                            </h3>
                            {agent.is_default && (
                              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                                Default
                              </span>
                            )}
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 capitalize">
                              {agent.type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                            {agent.system_prompt}
                          </p>
                        </div>
                        <div className="ml-4 flex space-x-2">
                          <button
                            onClick={() => handleEditAgent(agent)}
                            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          {!agent.is_default && (
                            <button
                              onClick={() => handleDeleteAgent(agent.id)}
                              className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Metrics Dashboard</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Track performance and insights from your AI agents
                </p>
              </div>

              {loadingMetrics ? (
                <div className="rounded-lg bg-white p-6 shadow-sm text-center">
                  <p className="text-sm text-gray-600">Loading metrics...</p>
                </div>
              ) : metrics ? (
                <div className="space-y-6">
                  {/* Action Statistics */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <div className="text-sm font-medium text-gray-600">Total Actions</div>
                      <div className="mt-2 text-3xl font-bold text-gray-900">
                        {metrics.actions.total}
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <div className="text-sm font-medium text-gray-600">Approval Rate</div>
                      <div className="mt-2 text-3xl font-bold text-green-600">
                        {metrics.actions.approval_rate.toFixed(1)}%
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {metrics.actions.accepted} accepted
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <div className="text-sm font-medium text-gray-600">Rejection Rate</div>
                      <div className="mt-2 text-3xl font-bold text-red-600">
                        {metrics.actions.rejection_rate.toFixed(1)}%
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {metrics.actions.rejected} rejected
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <div className="text-sm font-medium text-gray-600">Average Success Score</div>
                      <div className="mt-2 text-3xl font-bold text-blue-600">
                        {metrics.success_scores.average !== null
                          ? metrics.success_scores.average.toFixed(1)
                          : 'N/A'}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {metrics.success_scores.total_scored} scored
                      </div>
                    </div>
                  </div>

                  {/* Success Score Distribution */}
                  <div className="rounded-lg bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Success Score Distribution
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(metrics.success_scores.distribution)
                        .reverse()
                        .map(([score, count]: [string, any]) => {
                          const maxCount = Math.max(
                            ...Object.values(metrics.success_scores.distribution)
                          )
                          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0
                          const scoreNum = parseInt(score)
                          const colorClass =
                            scoreNum >= 3
                              ? 'bg-green-500'
                              : scoreNum >= 1
                              ? 'bg-blue-500'
                              : scoreNum >= -1
                              ? 'bg-yellow-500'
                              : 'bg-red-500'

                          return (
                            <div key={score} className="flex items-center space-x-4">
                              <div className="w-12 text-sm font-medium text-gray-700 text-right">
                                {score}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                                    <div
                                      className={`h-6 ${colorClass} rounded-full flex items-center justify-end pr-2`}
                                      style={{ width: `${percentage}%` }}
                                    >
                                      {count > 0 && (
                                        <span className="text-xs font-medium text-white">
                                          {count}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* Action Tracking Status */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Action Tracking Status
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Active Actions</span>
                          <span className="text-lg font-semibold text-blue-600">
                            {metrics.tracking.active}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Completed Actions</span>
                          <span className="text-lg font-semibold text-purple-600">
                            {metrics.tracking.completed}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Agent Performance */}
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Agent Performance
                      </h3>
                      <div className="space-y-3">
                        {metrics.agent_performance.length > 0 ? (
                          metrics.agent_performance.map((agent: any) => (
                            <div key={agent.name} className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-gray-900">
                                  {agent.name}
                                </span>
                                <span className="ml-2 text-xs text-gray-500 capitalize">
                                  ({agent.type.replace('_', ' ')})
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-gray-700">
                                {agent.count} runs
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No agent runs yet</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Rejections */}
                  {metrics.recent_rejections.length > 0 && (
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Recent Rejection Reasons
                      </h3>
                      <div className="space-y-3">
                        {metrics.recent_rejections.map((rejection: any, index: number) => (
                          <div
                            key={index}
                            className="rounded-md bg-red-50 p-3 border border-red-200"
                          >
                            <p className="text-sm text-gray-900">{rejection.rejection_reason}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {new Date(rejection.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Agent Runs */}
                  {metrics.recent_runs.length > 0 && (
                    <div className="rounded-lg bg-white p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Recent Agent Runs
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Started
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Completed
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {metrics.recent_runs.map((run: any) => (
                              <tr key={run.id}>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 capitalize">
                                  {run.run_type.replace('_', ' ')}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span
                                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      run.status === 'completed'
                                        ? 'bg-green-100 text-green-800'
                                        : run.status === 'running'
                                        ? 'bg-blue-100 text-blue-800'
                                        : run.status === 'failed'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                  >
                                    {run.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {run.started_at
                                    ? new Date(run.started_at).toLocaleString()
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                  {run.completed_at
                                    ? new Date(run.completed_at).toLocaleString()
                                    : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <h3 className="text-lg font-semibold text-gray-900">No metrics available</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Run your agents and manage actions to see metrics
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Proposed Actions</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Review and manage proposed actions from your AI agents
                  </p>
                </div>
                <button
                  onClick={handleRunAgents}
                  disabled={runningAgents}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {runningAgents ? 'Running Agents...' : 'Run Agents'}
                </button>
              </div>

              {loadingActions ? (
                <div className="rounded-lg bg-white p-6 shadow-sm text-center">
                  <p className="text-sm text-gray-600">Loading proposed actions...</p>
                </div>
              ) : proposedActions.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <h3 className="text-lg font-semibold text-gray-900">No proposed actions yet</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Run your AI agents to generate proposed actions
                  </p>
                  <button
                    onClick={handleRunAgents}
                    disabled={runningAgents}
                    className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {runningAgents ? 'Running...' : 'Run Agents'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {proposedActions.map((action) => {
                    const tracking = actionTracking[action.id]
                    const isEditing = editingTracking === action.id
                    
                    return (
                      <div
                        key={action.id}
                        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="text-lg font-semibold text-gray-900">
                                {action.title}
                              </h3>
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-medium ${
                                  action.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : action.status === 'accepted'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {action.status}
                              </span>
                              {tracking && (
                                <span
                                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                                    tracking.status === 'active'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}
                                >
                                  {tracking.status}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{action.description}</p>
                            <div className="mt-3 rounded-md bg-blue-50 p-3">
                              <p className="text-xs font-medium text-blue-900 mb-1">
                                Justification:
                              </p>
                              <p className="text-sm text-blue-800">{action.justification}</p>
                            </div>

                            {tracking && (
                              <div className="mt-4 rounded-md bg-gray-50 p-4 space-y-3">
                                <h4 className="text-sm font-semibold text-gray-900">
                                  Action Tracking
                                </h4>
                                {isEditing ? (
                                  <>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Comments
                                      </label>
                                      <textarea
                                        rows={3}
                                        value={trackingComments[action.id] || ''}
                                        onChange={(e) =>
                                          setTrackingComments({
                                            ...trackingComments,
                                            [action.id]: e.target.value,
                                          })
                                        }
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                        placeholder="Add comments about this action..."
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Success Score (-5 to 5)
                                      </label>
                                      <input
                                        type="number"
                                        min="-5"
                                        max="5"
                                        value={trackingScore[action.id] ?? ''}
                                        onChange={(e) =>
                                          setTrackingScore({
                                            ...trackingScore,
                                            [action.id]:
                                              e.target.value === ''
                                                ? null
                                                : parseInt(e.target.value),
                                          })
                                        }
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                        placeholder="Score from -5 (disastrous) to 5 (game-changing)"
                                      />
                                    </div>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleUpdateTracking(action.id, tracking.id)}
                                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingTracking(null)
                                          setTrackingComments({
                                            ...trackingComments,
                                            [action.id]: tracking.comments || '',
                                          })
                                          setTrackingScore({
                                            ...trackingScore,
                                            [action.id]: tracking.success_score,
                                          })
                                        }}
                                        className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                                      >
                                        Cancel
                                      </button>
                                      {tracking.status === 'active' && (
                                        <button
                                          onClick={() =>
                                            handleCompleteAction(action.id, tracking.id)
                                          }
                                          className="rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500"
                                        >
                                          Mark Complete
                                        </button>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {tracking.comments && (
                                      <div>
                                        <p className="text-xs font-medium text-gray-700 mb-1">
                                          Comments:
                                        </p>
                                        <p className="text-sm text-gray-600">{tracking.comments}</p>
                                      </div>
                                    )}
                                    {tracking.success_score !== null && (
                                      <div>
                                        <p className="text-xs font-medium text-gray-700 mb-1">
                                          Success Score:
                                        </p>
                                        <p className="text-sm text-gray-600">
                                          {tracking.success_score}/5
                                        </p>
                                      </div>
                                    )}
                                    {tracking.completed_at && (
                                      <div>
                                        <p className="text-xs font-medium text-gray-700 mb-1">
                                          Completed:
                                        </p>
                                        <p className="text-sm text-gray-600">
                                          {new Date(tracking.completed_at).toLocaleString()}
                                        </p>
                                      </div>
                                    )}
                                    {tracking.status === 'active' && (
                                      <button
                                        onClick={() => setEditingTracking(action.id)}
                                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                                      >
                                        Update Tracking
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            <p className="mt-3 text-xs text-gray-500">
                              Created {new Date(action.created_at).toLocaleString()}
                            </p>
                          </div>
                          {action.status === 'pending' && (
                            <div className="ml-4 flex space-x-2">
                              <button
                                onClick={() => handleAcceptAction(action.id)}
                                className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => setShowRejectionModal(action.id)}
                                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {showAgentModal && (
        <AgentModal
          projectId={projectId}
          agent={editingAgent}
          onClose={() => {
            setShowAgentModal(false)
            setEditingAgent(null)
          }}
          onSave={async () => {
            await loadAgents()
            setShowAgentModal(false)
            setEditingAgent(null)
            setMessage({ type: 'success', text: editingAgent ? 'Agent updated successfully!' : 'Agent created successfully!' })
          }}
        />
      )}

      {showRejectionModal && (
        <RejectionModal
          actionId={showRejectionModal}
          onClose={() => {
            setShowRejectionModal(null)
            setRejectionReason('')
          }}
          onReject={handleRejectAction}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
        />
      )}
    </div>
  )
}

// Rejection Modal Component
function RejectionModal({
  actionId,
  onClose,
  onReject,
  rejectionReason,
  setRejectionReason,
}: {
  actionId: string
  onClose: () => void
  onReject: (actionId: string) => void
  rejectionReason: string
  setRejectionReason: (reason: string) => void
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (rejectionReason.trim()) {
      onReject(actionId)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
            Reject Proposed Action
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="rejection-reason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Reason for Rejection *
              </label>
              <textarea
                id="rejection-reason"
                rows={4}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm px-3 py-2 border"
                placeholder="Please explain why you're rejecting this proposed action..."
              />
              <p className="mt-2 text-sm text-gray-500">
                This feedback will help improve future recommendations.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!rejectionReason.trim()}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject Action
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Agent Modal Component
function AgentModal({
  projectId,
  agent,
  onClose,
  onSave,
}: {
  projectId: string
  agent: Agent | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(agent?.name || '')
  const [type, setType] = useState(agent?.type || 'custom')
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update state when agent changes
  useEffect(() => {
    if (agent) {
      setName(agent.name)
      setType(agent.type)
      setSystemPrompt(agent.system_prompt)
    } else {
      setName('')
      setType('custom')
      setSystemPrompt('')
    }
    setError(null)
  }, [agent])

  const agentTypes = [
    { value: 'user_persona', label: 'User Persona' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'competitive_intel', label: 'Competitive Intelligence' },
    { value: 'researcher', label: 'User Researcher' },
    { value: 'designer', label: 'Designer' },
    { value: 'analyst', label: 'Product Analyst' },
    { value: 'ceo_cpo', label: 'CEO/CPO Assistant' },
    { value: 'custom', label: 'Custom' },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !systemPrompt.trim()) {
      setError('Name and system prompt are required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const url = agent ? `/api/agents/${agent.id}` : '/api/agents'
      const method = agent ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          name,
          type,
          system_prompt: systemPrompt,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save agent')
      }

      onSave()
    } catch (err: any) {
      setError(err.message || 'Failed to save agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:p-6">
          <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">
            {agent ? 'Edit Agent' : 'Create Custom Agent'}
          </h3>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-800">{error}</div>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="agent-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Agent Name *
                </label>
                <input
                  type="text"
                  id="agent-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                  placeholder="My Custom Agent"
                />
              </div>
              <div>
                <label
                  htmlFor="agent-type"
                  className="block text-sm font-medium text-gray-700"
                >
                  Agent Type *
                </label>
                <select
                  id="agent-type"
                  required
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                  disabled={agent?.is_default}
                >
                  {agentTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="system-prompt"
                  className="block text-sm font-medium text-gray-700"
                >
                  System Prompt *
                </label>
                <textarea
                  id="system-prompt"
                  rows={10}
                  required
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                  placeholder="You are an AI agent that..."
                />
                <p className="mt-2 text-sm text-gray-500">
                  Define the agent's role, responsibilities, and behavior. This prompt will be used to guide the agent's analysis.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim() || !systemPrompt.trim()}
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : agent ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

