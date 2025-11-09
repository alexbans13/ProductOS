# ProductOS

**Product Manager AI Assistant**

ProductOS is an AI-powered product management assistant that helps product managers make data-driven decisions through intelligent analysis, agent-based insights, and actionable recommendations.

## 🚀 Features

- **Project Management** - Create and manage multiple product projects
- **Data Source Integration** - Connect Notion and other data sources
- **AI Agent System** - Configure specialized AI agents for different analysis types
- **Agent Orchestration** - Automated data refresh, concurrent agent execution, and CEO synthesis
- **Proposed Actions** - Receive 2-3 actionable recommendations with justifications
- **Action Tracking** - Track action outcomes with success scores (-5 to 5)
- **Learning System** - Agents learn from rejection feedback to improve recommendations
- **Metrics Dashboard** - Comprehensive analytics and performance tracking

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/alexbans13/ProductOS.git

# Install dependencies
npm install

# Set up environment variables (see SETUP.md)
cp .env.local.example .env.local

# Run database migration in Supabase dashboard
# Execute: supabase/migrations/001_initial_schema.sql

# Start development server
npm run dev
```

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **AI/LLM:** OpenAI GPT-4o
- **Integrations:** Notion API

## 📚 Documentation

- [Setup Guide](SETUP.md) - Detailed setup instructions
- [Release Notes](RELEASE_NOTES_v1.0.0.md) - v1.0.0 release information

## 🔗 Links

- **Repository:** https://github.com/alexbans13/ProductOS
- **Latest Release:** [v1.0.0](https://github.com/alexbans13/ProductOS/releases/tag/v1.0.0)

## 📝 License

[Add your license here]

