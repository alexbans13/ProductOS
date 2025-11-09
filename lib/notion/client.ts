import { Client } from '@notionhq/client'

export function createNotionClient(accessToken: string) {
  return new Client({
    auth: accessToken,
  })
}

export async function fetchNotionPages(client: Client) {
  try {
    const response = await client.search({
      filter: {
        property: 'object',
        value: 'page',
      },
    })
    return response.results
  } catch (error) {
    console.error('Error fetching Notion pages:', error)
    throw error
  }
}

export async function fetchNotionDatabases(client: Client) {
  try {
    const response = await client.search({
      filter: {
        property: 'object',
        value: 'database',
      },
    })
    return response.results
  } catch (error) {
    console.error('Error fetching Notion databases:', error)
    throw error
  }
}

export async function fetchNotionPageContent(client: Client, pageId: string) {
  try {
    const page = await client.pages.retrieve({ page_id: pageId })
    const blocks = await client.blocks.children.list({ block_id: pageId })
    return {
      page,
      blocks: blocks.results,
    }
  } catch (error) {
    console.error('Error fetching Notion page content:', error)
    throw error
  }
}

export async function fetchNotionDatabaseContent(client: Client, databaseId: string) {
  try {
    const database = await client.databases.retrieve({ database_id: databaseId })
    const pages = await client.databases.query({ database_id: databaseId })
    return {
      database,
      pages: pages.results,
    }
  } catch (error) {
    console.error('Error fetching Notion database content:', error)
    throw error
  }
}

