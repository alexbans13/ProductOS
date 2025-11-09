'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { dataSourceConfigs, type DataSourceConfig } from '@/lib/data-sources/config'

interface Project {
  id: string
  name: string
  description: string | null
  image_url: string | null
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
  const [editingOverview, setEditingOverview] = useState(false)
  const [editDescription, setEditDescription] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [runningAgentId, setRunningAgentId] = useState<string | null>(null)
  const [runningAllAgents, setRunningAllAgents] = useState(false)
  const [agentResults, setAgentResults] = useState<Record<string, any[]>>({})
  const [expandedResults, setExpandedResults] = useState<Record<string, boolean>>({})
  // Cache for tab data to avoid reloading on tab switches
  const [dataCache, setDataCache] = useState<{
    'data-sources'?: DataSource[]
    'agents'?: Agent[]
    'actions'?: any[]
    'metrics'?: any
    'agent-results'?: Record<string, any[]>
  }>({})
  const supabase = createClient()

  useEffect(() => {
    loadProject()
  }, [projectId])

  useEffect(() => {
    // Only load data if not cached
    if (activeTab === 'data-sources' && !dataCache['data-sources']) {
      loadDataSources()
    } else if (activeTab === 'agents' && !dataCache['agents']) {
      loadAgents()
    } else if (activeTab === 'actions' && !dataCache['actions']) {
      loadProposedActions()
    } else if (activeTab === 'metrics' && !dataCache['metrics']) {
      loadMetrics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setEditDescription(data.project.description || '')
    } catch (error) {
      console.error('Error loading project:', error)
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDescription = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: editDescription || null }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update description')
      }

      const data = await response.json()
      setProject(data.project)
      setEditingOverview(false)
      setMessage({ type: 'success', text: 'Project description updated successfully!' })
    } catch (error: any) {
      console.error('Error updating description:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to update description' })
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'File must be an image' })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Image must be less than 5MB' })
      return
    }

    setUploadingImage(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch(`/api/projects/${projectId}/upload-image`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload image')
      }

      const data = await response.json()
      setProject(data.project)
      setMessage({ type: 'success', text: 'Project image uploaded successfully!' })
    } catch (error: any) {
      console.error('Error uploading image:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to upload image' })
    } finally {
      setUploadingImage(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const loadDataSources = useCallback(async () => {
    // Return cached data if available
    if (dataCache['data-sources']) {
      setDataSources(dataCache['data-sources'])
      return
    }

    setLoadingDataSources(true)
    try {
      const response = await fetch(`/api/data-sources?project_id=${projectId}`)
      if (!response.ok) throw new Error('Failed to load data sources')
      const data = await response.json()
      const sources = data.dataSources || []
      setDataSources(sources)
      setDataCache(prev => ({ ...prev, 'data-sources': sources }))
    } catch (error) {
      console.error('Error loading data sources:', error)
    } finally {
      setLoadingDataSources(false)
    }
  }, [projectId])

  const handleConnectDataSource = (config: DataSourceConfig) => {
    if (config.status === 'coming_soon') {
      setMessage({ type: 'error', text: `${config.name} integration is coming soon!` })
      return
    }

    if (config.oauthUrl) {
      window.location.href = `${config.oauthUrl}?project_id=${projectId}`
    }
  }

  const getDataSourceStatus = (config: DataSourceConfig): 'connected' | 'available' | 'coming_soon' => {
    if (config.status === 'coming_soon') return 'coming_soon'
    const connected = dataSources.find((ds) => ds.type === config.type && ds.status === 'connected')
    return connected ? 'connected' : 'available'
  }

  // Memoize filtered data sources to avoid recalculating on every render
  const filteredDataSources = useMemo(() => {
    if (!searchQuery.trim()) return dataSourceConfigs
    const query = searchQuery.toLowerCase()
    return dataSourceConfigs.filter((config) => 
      config.name.toLowerCase().includes(query) ||
      config.description.toLowerCase().includes(query) ||
      config.type.toLowerCase().includes(query)
    )
  }, [searchQuery])

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

      const updatedSources = dataSources.filter((ds) => ds.id !== dataSourceId)
      setDataSources(updatedSources)
      setDataCache(prev => ({ ...prev, 'data-sources': updatedSources }))
    } catch (error) {
      console.error('Error disconnecting data source:', error)
      alert('Failed to disconnect data source. Please try again.')
    } finally {
      setDisconnectingId(null)
    }
  }

  const loadAgentResults = useCallback(async (agentIds: string[]) => {
    try {
      // Parallelize all agent result fetches
      const results = await Promise.all(
        agentIds.map(async (agentId) => {
          try {
            const response = await fetch(`/api/agent-outputs?agent_id=${agentId}`)
            if (response.ok) {
              const data = await response.json()
              return { agentId, outputs: data.outputs || [] }
            }
            return { agentId, outputs: [] }
          } catch (error) {
            console.error(`Error loading results for agent ${agentId}:`, error)
            return { agentId, outputs: [] }
          }
        })
      )
      
      const resultsMap: Record<string, any[]> = {}
      results.forEach(({ agentId, outputs }) => {
        resultsMap[agentId] = outputs
      })
      
      setAgentResults(resultsMap)
      setDataCache(prev => ({ ...prev, 'agent-results': resultsMap }))
    } catch (error) {
      console.error('Error loading agent results:', error)
    }
  }, [])

  const loadAgents = useCallback(async () => {
    // Return cached data if available
    if (dataCache['agents']) {
      setAgents(dataCache['agents'])
      setShowCreateDefaultAgents(dataCache['agents'].length === 0)
      if (dataCache['agent-results']) {
        setAgentResults(dataCache['agent-results'])
      }
      return
    }

    setLoadingAgents(true)
    try {
      const response = await fetch(`/api/agents?project_id=${projectId}`)
      if (!response.ok) throw new Error('Failed to load agents')
      const data = await response.json()
      const agentsList = data.agents || []
      setAgents(agentsList)
      setShowCreateDefaultAgents(agentsList.length === 0)
      setDataCache(prev => ({ ...prev, 'agents': agentsList }))
      
      // Load results for each agent
      if (agentsList.length > 0) {
        await loadAgentResults(agentsList.map((a: Agent) => a.id))
      }
    } catch (error) {
      console.error('Error loading agents:', error)
    } finally {
      setLoadingAgents(false)
    }
  }, [projectId, loadAgentResults])

  const handleRunAgent = async (agentId: string) => {
    setRunningAgentId(agentId)
    try {
      const response = await fetch(`/api/agents/${agentId}/run`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to run agent')
      }

      const data = await response.json()
      
      // Reload results for this agent
      await loadAgentResults([agentId])
      
      setMessage({ 
        type: 'success', 
        text: `Agent "${agents.find(a => a.id === agentId)?.name}" completed successfully!` 
      })
    } catch (error: any) {
      console.error('Error running agent:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to run agent' })
    } finally {
      setRunningAgentId(null)
    }
  }

  const handleRunAllAgents = async () => {
    setRunningAllAgents(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/agents/run-all`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to run all agents')
      }

      const data = await response.json()
      
      // Reload results for all agents
      await loadAgentResults(agents.map(a => a.id))
      
      const successCount = data.results.filter((r: any) => !r.error).length
      const totalCount = data.results.length
      
      setMessage({ 
        type: 'success', 
        text: `Ran ${totalCount} agents: ${successCount} succeeded, ${totalCount - successCount} failed` 
      })
    } catch (error: any) {
      console.error('Error running all agents:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to run all agents' })
    } finally {
      setRunningAllAgents(false)
    }
  }

  const toggleResultExpanded = (resultId: string) => {
    setExpandedResults(prev => ({
      ...prev,
      [resultId]: !prev[resultId]
    }))
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

      const updatedAgents = agents.filter((a) => a.id !== agentId)
      setAgents(updatedAgents)
      setDataCache(prev => ({ ...prev, 'agents': updatedAgents }))
      setMessage({ type: 'success', text: 'Agent deleted successfully!' })
    } catch (error: any) {
      console.error('Error deleting agent:', error)
      setMessage({ type: 'error', text: error.message || 'Failed to delete agent' })
    }
  }

  const loadProposedActions = useCallback(async () => {
    // Return cached data if available
    if (dataCache['actions']) {
      setProposedActions(dataCache['actions'])
      return
    }

    setLoadingActions(true)
    try {
      const response = await fetch(`/api/proposed-actions?project_id=${projectId}`)
      if (!response.ok) throw new Error('Failed to load proposed actions')
      const data = await response.json()
      const actions = data.actions || []
      setProposedActions(actions)
      setDataCache(prev => ({ ...prev, 'actions': actions }))

      // Load tracking for accepted actions in parallel
      const acceptedActions = actions.filter((a: any) => a.status === 'accepted')
      if (acceptedActions.length > 0) {
        const trackingPromises = acceptedActions.map(async (action: any) => {
          try {
            const trackingResponse = await fetch(`/api/proposed-actions/${action.id}`)
            if (trackingResponse.ok) {
              const trackingData = await trackingResponse.json()
              return { actionId: action.id, tracking: trackingData.action?.tracking || trackingData.tracking || null }
            }
            return { actionId: action.id, tracking: null }
          } catch (error) {
            console.error(`Error loading tracking for action ${action.id}:`, error)
            return { actionId: action.id, tracking: null }
          }
        })

        const trackingResults = await Promise.all(trackingPromises)
        const trackingMap: Record<string, any> = {}
        const commentsMap: Record<string, string> = {}
        const scoreMap: Record<string, number | null> = {}
        
        trackingResults.forEach(({ actionId, tracking }) => {
          if (tracking) {
            trackingMap[actionId] = tracking
            commentsMap[actionId] = tracking.comments || ''
            scoreMap[actionId] = tracking.success_score || null
          }
        })
        
        setActionTracking(trackingMap)
        setTrackingComments(commentsMap)
        setTrackingScore(scoreMap)
      }
    } catch (error) {
      console.error('Error loading proposed actions:', error)
    } finally {
      setLoadingActions(false)
    }
  }, [projectId])

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

  const loadMetrics = useCallback(async () => {
    // Return cached data if available
    if (dataCache['metrics']) {
      setMetrics(dataCache['metrics'])
      return
    }

    setLoadingMetrics(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/metrics`)
      if (!response.ok) throw new Error('Failed to load metrics')
      const data = await response.json()
      setMetrics(data.metrics)
      setDataCache(prev => ({ ...prev, 'metrics': data.metrics }))
    } catch (error) {
      console.error('Error loading metrics:', error)
    } finally {
      setLoadingMetrics(false)
    }
  }, [projectId])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Format input message for better readability
  const formatInputMessage = (message: string): string => {
    if (!message || message === 'N/A') return '<p class="text-gray-500 italic">No input context available</p>'
    
    // Escape HTML first to prevent XSS
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }
    
    // Replace markdown-style headers with readable text
    let formatted = escapeHtml(message)
      .replace(/^# (.+)$/gm, '<h3 class="font-semibold text-gray-900 mt-4 mb-2 text-base">$1</h3>')
      .replace(/^## (.+)$/gm, '<h4 class="font-semibold text-gray-800 mt-3 mb-2 text-sm">$1</h4>')
      .replace(/^### (.+)$/gm, '<h5 class="font-medium text-gray-700 mt-2 mb-1 text-sm">$1</h5>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1">• $1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-1">$1</li>')
      .replace(/^---$/gm, '<hr class="my-4 border-gray-300" />')
    
    // Split into paragraphs
    const paragraphs = formatted.split('\n\n').filter(p => p.trim())
    return paragraphs.map(p => {
      if (p.trim().startsWith('<')) {
        return p.trim()
      }
      return `<p class="mb-2 leading-relaxed">${p.trim().replace(/\n/g, '<br />')}</p>`
    }).join('')
  }

  // Format output for better readability
  const formatOutput = (output: string): string => {
    if (!output || output === 'No output') return '<p class="text-gray-500 italic">No output available</p>'
    
    // Escape HTML first to prevent XSS
    const escapeHtml = (text: string) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
    }
    
    // Parse markdown and format
    let formatted = escapeHtml(output)
      // Headers (must be done before other replacements)
      .replace(/^# (.+)$/gm, '<h3 class="font-bold text-gray-900 text-base mt-4 mb-3 pb-2 border-b border-gray-200">$1</h3>')
      .replace(/^## (.+)$/gm, '<h4 class="font-semibold text-gray-800 text-sm mt-3 mb-2">$1</h4>')
      .replace(/^### (.+)$/gm, '<h5 class="font-medium text-gray-700 text-sm mt-2 mb-1">$1</h5>')
      // Code blocks (before inline code)
      .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-3 rounded text-xs my-3 overflow-x-auto border border-gray-200"><code class="font-mono">$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
      // Bold (after code to avoid conflicts)
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      // Italic (after bold to avoid conflicts)
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>')
      // Bullet points
      .replace(/^- (.+)$/gm, '<li class="ml-4 mb-1.5 list-disc">$1</li>')
      // Numbered lists
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 mb-1.5 list-decimal">$1</li>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr class="my-4 border-gray-300" />')
    
    // Split into paragraphs and format
    const paragraphs = formatted.split('\n\n').filter(p => p.trim())
    return paragraphs.map(p => {
      const trimmed = p.trim()
      if (trimmed.startsWith('<')) {
        return trimmed
      }
      // Check if it's already a list item
      if (trimmed.startsWith('<li')) {
        return `<ul class="list-none space-y-1">${trimmed}</ul>`
      }
      return `<p class="mb-3 leading-relaxed">${trimmed.replace(/\n/g, '<br />')}</p>`
    }).join('')
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
            <div className="flex items-center space-x-3">
              <Link
                href="/profile"
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
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
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Project Overview</h2>
                {!editingOverview && (
                  <button
                    onClick={() => setEditingOverview(true)}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                  >
                    Edit
                  </button>
                )}
              </div>

              <div className="rounded-lg bg-white p-6 shadow-sm">
                {project.image_url && (
                  <div className="mb-6">
                    <img
                      src={project.image_url}
                      alt={project.name}
                      className="w-full h-64 object-cover rounded-lg"
                    />
                  </div>
                )}

                {editingOverview ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Image
                      </label>
                      <div className="flex items-center space-x-4">
                        {project.image_url && (
                          <img
                            src={project.image_url}
                            alt={project.name}
                            className="w-32 h-32 object-cover rounded-lg"
                          />
                        )}
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploadingImage}
                            className="block w-full text-sm text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            {uploadingImage ? 'Uploading...' : 'Upload a new image (max 5MB)'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        rows={4}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder:text-gray-400"
                        placeholder="Describe your product project..."
                      />
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={handleUpdateDescription}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => {
                          setEditingOverview(false)
                          setEditDescription(project.description || '')
                        }}
                        className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {project.description ? (
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-1">Description</p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">
                          {project.description}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No description added yet.</p>
                    )}
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
                )}
              </div>
            </div>
          )}

          {activeTab === 'data-sources' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Data Sources</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Connect your data sources to enable AI agent analysis
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search data sources..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2 pl-10 border text-gray-900 placeholder:text-gray-400"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              {loadingDataSources ? (
                <div className="rounded-lg bg-white p-6 shadow-sm text-center">
                  <p className="text-sm text-gray-600">Loading data sources...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredDataSources.map((config) => {
                    const status = getDataSourceStatus(config)
                    const connectedDataSource = dataSources.find(
                      (ds) => ds.type === config.type && ds.status === 'connected'
                    )

                    // Color mapping for Tailwind classes
                    const colorClasses = {
                      blue: {
                        border: 'border-blue-300',
                        bg: 'bg-blue-50',
                        iconBg: 'bg-blue-100',
                        button: 'bg-blue-600 hover:bg-blue-500',
                      },
                      purple: {
                        border: 'border-purple-300',
                        bg: 'bg-purple-50',
                        iconBg: 'bg-purple-100',
                        button: 'bg-purple-600 hover:bg-purple-500',
                      },
                      pink: {
                        border: 'border-pink-300',
                        bg: 'bg-pink-50',
                        iconBg: 'bg-pink-100',
                        button: 'bg-pink-600 hover:bg-pink-500',
                      },
                      gray: {
                        border: 'border-gray-300',
                        bg: 'bg-gray-50',
                        iconBg: 'bg-gray-100',
                        button: 'bg-gray-600 hover:bg-gray-500',
                      },
                      indigo: {
                        border: 'border-indigo-300',
                        bg: 'bg-indigo-50',
                        iconBg: 'bg-indigo-100',
                        button: 'bg-indigo-600 hover:bg-indigo-500',
                      },
                    }

                    const colors = colorClasses[config.color as keyof typeof colorClasses] || colorClasses.blue

                    return (
                      <div
                        key={config.id}
                        className={`relative rounded-lg border-2 p-6 shadow-sm transition-all ${
                          status === 'connected'
                            ? `${colors.border} ${colors.bg}`
                            : status === 'available'
                            ? 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                            : 'border-gray-200 bg-gray-50 opacity-75'
                        }`}
                      >
                        {/* Status Badge */}
                        <div className="absolute top-4 right-4">
                          {status === 'connected' && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-400 mr-1.5"></span>
                              Connected
                            </span>
                          )}
                          {status === 'available' && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              Available
                            </span>
                          )}
                          {status === 'coming_soon' && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              Coming Soon
                            </span>
                          )}
                        </div>

                        {/* Icon */}
                        <div className="mb-4">
                          <div
                            className={`inline-flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${
                              status === 'connected'
                                ? colors.iconBg
                                : 'bg-gray-100'
                            }`}
                          >
                            {config.icon}
                          </div>
                        </div>

                        {/* Content */}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {config.name}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">{config.description}</p>

                          {/* Connection Info */}
                          {connectedDataSource && connectedDataSource.connected_at && (
                            <p className="text-xs text-gray-500 mb-4">
                              Connected {new Date(connectedDataSource.connected_at).toLocaleDateString()}
                            </p>
                          )}

                          {/* Actions */}
                          <div className="flex space-x-2">
                            {status === 'connected' ? (
                              <button
                                onClick={() => handleDisconnect(connectedDataSource!.id)}
                                disabled={disconnectingId === connectedDataSource!.id}
                                className="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {disconnectingId === connectedDataSource!.id
                                  ? 'Disconnecting...'
                                  : 'Disconnect'}
                              </button>
                            ) : status === 'available' ? (
                              <button
                                onClick={() => handleConnectDataSource(config)}
                                className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm ${colors.button}`}
                              >
                                Connect
                              </button>
                            ) : (
                              <button
                                disabled
                                className="flex-1 rounded-md bg-gray-200 px-3 py-2 text-sm font-semibold text-gray-500 cursor-not-allowed"
                              >
                                Coming Soon
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {filteredDataSources.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <h3 className="text-lg font-semibold text-gray-900">No data sources found</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Try adjusting your search query
                  </p>
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
                <div className="flex items-center space-x-3">
                  {!showCreateDefaultAgents && agents.length > 0 && (
                    <button
                      onClick={handleRunAllAgents}
                      disabled={runningAllAgents}
                      className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                    >
                      {runningAllAgents ? 'Running All Agents...' : 'Run All Agents'}
                    </button>
                  )}
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
                  {agents.map((agent) => {
                    const results = agentResults[agent.id] || []
                    return (
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
                              onClick={() => handleRunAgent(agent.id)}
                              disabled={runningAgentId === agent.id || runningAllAgents}
                              className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {runningAgentId === agent.id ? 'Running...' : 'Run Agent'}
                            </button>
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
                        
                        {/* Agent Results */}
                        {results.length > 0 && (
                          <div className="mt-6 space-y-3">
                            <h4 className="text-sm font-semibold text-gray-900">
                              Recent Runs ({results.length})
                            </h4>
                            {results.slice(0, 5).map((result: any) => {
                              const resultId = `${agent.id}-${result.id}`
                              const isExpanded = expandedResults[resultId]
                              const metadata = result.metadata || {}
                              const inputMessage = metadata.input_message || 'N/A'
                              const output = result.output_text || 'No output'
                              const hasError = metadata.error || output.startsWith('Error:')
                              
                              return (
                                <div
                                  key={result.id}
                                  className="rounded-lg border border-gray-200 bg-gray-50"
                                >
                                  <button
                                    onClick={() => toggleResultExpanded(resultId)}
                                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 transition-colors"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <div className={`h-2 w-2 rounded-full ${hasError ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                      <span className="text-sm font-medium text-gray-900">
                                        {new Date(result.created_at).toLocaleString()}
                                      </span>
                                      {hasError && (
                                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                                          Error
                                        </span>
                                      )}
                                    </div>
                                    <svg
                                      className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                  </button>
                                  
                                  {isExpanded && (
                                    <div className="border-t border-gray-200 p-4 space-y-4">
                                      {/* Input Message */}
                                      <div>
                                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                                          Input Context
                                        </h5>
                                        <div className="rounded-md bg-white p-4 border border-gray-200">
                                          <div 
                                            className="text-sm text-gray-800 prose prose-sm max-w-none"
                                            dangerouslySetInnerHTML={{ __html: formatInputMessage(inputMessage) }}
                                          />
                                        </div>
                                      </div>
                                      
                                      {/* Output */}
                                      <div>
                                        <h5 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                                          Agent Analysis
                                        </h5>
                                        <div className={`rounded-md p-4 border ${
                                          hasError 
                                            ? 'bg-red-50 border-red-200' 
                                            : 'bg-white border-gray-200'
                                        }`}>
                                          <div 
                                            className={`text-sm prose prose-sm max-w-none ${
                                              hasError ? 'text-red-800' : 'text-gray-800'
                                            }`}
                                            dangerouslySetInnerHTML={{ __html: formatOutput(output) }}
                                          />
                                        </div>
                                      </div>
                                      
                                      {/* Error Details */}
                                      {hasError && metadata.error && (
                                        <div>
                                          <h5 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                                            Error Details
                                          </h5>
                                          <div className="rounded-md bg-red-50 p-3 border border-red-200">
                                            <p className="text-sm text-red-800">{metadata.error}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
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
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder:text-gray-400"
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
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder:text-gray-400"
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
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder:text-gray-400"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder:text-gray-400"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border text-gray-900 placeholder:text-gray-400"
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

