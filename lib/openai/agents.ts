import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface AgentContext {
  projectName: string
  projectDescription: string | null
  refreshedData: any
  previousRejections?: string[]
}

export async function runAgent(
  systemPrompt: string,
  context: AgentContext,
  userMessage?: string
): Promise<string> {
  try {
    // Enhance system prompt with formatting instructions
    const enhancedSystemPrompt = `${systemPrompt}

IMPORTANT FORMATTING REQUIREMENTS:
- Format your response in clear, human-readable text (not JSON)
- Use markdown formatting with headings (##, ###), bullet points (-), and numbered lists
- Organize your analysis into clear sections with descriptive headings
- Use bold text (**text**) for emphasis on key points
- Break up long paragraphs for readability
- Include specific examples and data points where relevant
- End with clear, actionable recommendations or insights`

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: enhancedSystemPrompt,
      },
      {
        role: 'user',
        content: userMessage || buildContextMessage(context),
      },
    ]

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    })

    return response.choices[0]?.message?.content || 'No response generated'
  } catch (error: any) {
    console.error('Error running agent:', error)
    throw new Error(`Failed to run agent: ${error.message}`)
  }
}

function buildContextMessage(context: AgentContext): string {
  let message = `# Project Context\n\n`
  message += `**Project Name:** ${context.projectName}\n\n`
  
  if (context.projectDescription) {
    message += `**Project Description:**\n${context.projectDescription}\n\n`
  }

  message += `## Available Data Sources\n\n`
  
  // Format data sources in a human-readable way
  if (context.refreshedData && Object.keys(context.refreshedData).length > 0) {
    if (context.refreshedData.notion) {
      message += `### Notion Data\n`
      const notion = context.refreshedData.notion
      if (notion.pages && notion.pages.length > 0) {
        message += `**Pages Available:** ${notion.pages.length} page(s)\n`
        if (notion.pages.length <= 5) {
          notion.pages.forEach((page: any, idx: number) => {
            message += `  ${idx + 1}. ${page.title || 'Untitled Page'}\n`
          })
        }
        message += '\n'
      }
      if (notion.databases && notion.databases.length > 0) {
        message += `**Databases Available:** ${notion.databases.length} database(s)\n`
        if (notion.databases.length <= 5) {
          notion.databases.forEach((db: any, idx: number) => {
            message += `  ${idx + 1}. ${db.title || 'Untitled Database'}\n`
          })
        }
        message += '\n'
      }
    }
  } else {
    message += `No data sources are currently connected.\n\n`
  }

  if (context.previousRejections && context.previousRejections.length > 0) {
    message += `## Previous Action Rejections\n\n`
    message += `The following actions were previously rejected. Please learn from these to improve your recommendations:\n\n`
    context.previousRejections.forEach((rejection, index) => {
      message += `${index + 1}. ${rejection}\n`
    })
    message += '\n'
  }

  message += `---\n\n`
  message += `Please analyze the available data and provide your insights and recommendations in a clear, well-structured format. Use headings, bullet points, and clear sections to organize your analysis.`

  return message
}

export async function runCEOSynthesisAgent(
  systemPrompt: string,
  context: AgentContext,
  agentOutputs: Array<{ agent_name: string; output: string }>
): Promise<Array<{ title: string; description: string; justification: string }>> {
  try {
    let userMessage = `Project: ${context.projectName}\n\n`
    
    if (context.projectDescription) {
      userMessage += `Description: ${context.projectDescription}\n\n`
    }

    userMessage += `Agent Analyses:\n\n`
    agentOutputs.forEach((output, index) => {
      userMessage += `${index + 1}. ${output.agent_name}:\n${output.output}\n\n`
    })

    if (context.previousRejections && context.previousRejections.length > 0) {
      userMessage += `Previous Action Rejections (learn from these):\n`
      context.previousRejections.forEach((rejection, index) => {
        userMessage += `${index + 1}. ${rejection}\n`
      })
      userMessage += '\n'
    }

    userMessage += `Based on all the agent analyses above, please provide 2-3 proposed actions. Each action should have:
- A clear, concise title
- A detailed description
- A strong justification explaining why this action should be taken

Format your response as a JSON array with the following structure:
[
  {
    "title": "Action title",
    "description": "Detailed description",
    "justification": "Why this action should be taken"
  }
]`

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userMessage,
      },
    ]

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(content)
    
    // Handle both array and object with actions array
    let actions: Array<{ title: string; description: string; justification: string }> = []
    if (Array.isArray(parsed)) {
      actions = parsed
    } else if (parsed.actions && Array.isArray(parsed.actions)) {
      actions = parsed.actions
    } else if (parsed.proposed_actions && Array.isArray(parsed.proposed_actions)) {
      actions = parsed.proposed_actions
    }

    // Ensure we have 2-3 actions
    if (actions.length === 0) {
      throw new Error('No actions generated')
    }

    // Limit to 3 actions max
    return actions.slice(0, 3)
  } catch (error: any) {
    console.error('Error running CEO synthesis agent:', error)
    throw new Error(`Failed to run CEO synthesis agent: ${error.message}`)
  }
}

