export interface DataSourceConfig {
  id: string
  name: string
  description: string
  icon: string // Emoji or icon name
  status: 'available' | 'coming_soon'
  type: 'notion' | 'jira' | 'slack' | 'github' | 'linear' | 'other'
  oauthUrl?: string // API endpoint for OAuth connection
  color: string // Tailwind color class for the card
}

export const dataSourceConfigs: DataSourceConfig[] = [
  {
    id: 'notion',
    name: 'Notion',
    description: 'Connect your Notion workspace to sync pages, databases, and content',
    icon: '📝',
    status: 'available',
    type: 'notion',
    oauthUrl: '/api/data-sources/notion/connect',
    color: 'blue',
  },
  {
    id: 'jira',
    name: 'JIRA',
    description: 'Sync your JIRA issues, epics, and project data',
    icon: '🎯',
    status: 'coming_soon',
    type: 'jira',
    color: 'purple',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Connect Slack channels to analyze team communications and feedback',
    icon: '💬',
    status: 'coming_soon',
    type: 'slack',
    color: 'pink',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sync GitHub repositories, issues, and pull requests',
    icon: '💻',
    status: 'coming_soon',
    type: 'github',
    color: 'gray',
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Connect Linear workspace to sync issues and project data',
    icon: '📊',
    status: 'coming_soon',
    type: 'other',
    color: 'indigo',
  },
]

export function getDataSourceConfig(type: string): DataSourceConfig | undefined {
  return dataSourceConfigs.find((config) => config.id === type || config.type === type)
}

