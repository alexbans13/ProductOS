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
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
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
  let message = `Project: ${context.projectName}\n`
  
  if (context.projectDescription) {
    message += `Description: ${context.projectDescription}\n\n`
  }

  message += `Refreshed Data:\n${JSON.stringify(context.refreshedData, null, 2)}\n\n`

  if (context.previousRejections && context.previousRejections.length > 0) {
    message += `Previous Action Rejections (learn from these):\n`
    context.previousRejections.forEach((rejection, index) => {
      message += `${index + 1}. ${rejection}\n`
    })
    message += '\n'
  }

  message += `Please analyze this data and provide your insights and recommendations.`

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

