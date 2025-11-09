-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data sources table
CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('notion', 'jira', 'slack', 'other')),
  credentials JSONB, -- Encrypted OAuth tokens and credentials
  oauth_token TEXT, -- Encrypted OAuth token
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('user_persona', 'marketing', 'competitive_intel', 'researcher', 'designer', 'analyst', 'ceo_cpo', 'custom')),
  system_prompt TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent runs table
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('data_refresh', 'agent_analysis', 'final_synthesis')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent outputs table
CREATE TABLE agent_outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  output_text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Proposed actions table
CREATE TABLE proposed_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  justification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Action rejections table
CREATE TABLE action_rejections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposed_action_id UUID NOT NULL REFERENCES proposed_actions(id) ON DELETE CASCADE,
  rejection_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Action tracking table
CREATE TABLE action_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposed_action_id UUID NOT NULL REFERENCES proposed_actions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  comments TEXT,
  success_score INTEGER CHECK (success_score >= -5 AND success_score <= 5),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_data_sources_project_id ON data_sources(project_id);
CREATE INDEX idx_agents_project_id ON agents(project_id);
CREATE INDEX idx_agent_runs_project_id ON agent_runs(project_id);
CREATE INDEX idx_agent_outputs_agent_run_id ON agent_outputs(agent_run_id);
CREATE INDEX idx_agent_outputs_agent_id ON agent_outputs(agent_id);
CREATE INDEX idx_proposed_actions_project_id ON proposed_actions(project_id);
CREATE INDEX idx_proposed_actions_status ON proposed_actions(status);
CREATE INDEX idx_action_rejections_proposed_action_id ON action_rejections(proposed_action_id);
CREATE INDEX idx_action_tracking_proposed_action_id ON action_tracking(proposed_action_id);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposed_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects
CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for data_sources
CREATE POLICY "Users can view data sources for their projects"
  ON data_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = data_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create data sources for their projects"
  ON data_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = data_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update data sources for their projects"
  ON data_sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = data_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete data sources for their projects"
  ON data_sources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = data_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for agents
CREATE POLICY "Users can view agents for their projects"
  ON agents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = agents.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create agents for their projects"
  ON agents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = agents.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update agents for their projects"
  ON agents FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = agents.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete agents for their projects"
  ON agents FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = agents.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for agent_runs
CREATE POLICY "Users can view agent runs for their projects"
  ON agent_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = agent_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create agent runs for their projects"
  ON agent_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = agent_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update agent runs for their projects"
  ON agent_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = agent_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for agent_outputs
CREATE POLICY "Users can view agent outputs for their projects"
  ON agent_outputs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_runs
      JOIN projects ON projects.id = agent_runs.project_id
      WHERE agent_runs.id = agent_outputs.agent_run_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create agent outputs for their projects"
  ON agent_outputs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_runs
      JOIN projects ON projects.id = agent_runs.project_id
      WHERE agent_runs.id = agent_outputs.agent_run_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for proposed_actions
CREATE POLICY "Users can view proposed actions for their projects"
  ON proposed_actions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = proposed_actions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create proposed actions for their projects"
  ON proposed_actions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = proposed_actions.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update proposed actions for their projects"
  ON proposed_actions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = proposed_actions.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for action_rejections
CREATE POLICY "Users can view action rejections for their projects"
  ON action_rejections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposed_actions
      JOIN projects ON projects.id = proposed_actions.project_id
      WHERE proposed_actions.id = action_rejections.proposed_action_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create action rejections for their projects"
  ON action_rejections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposed_actions
      JOIN projects ON projects.id = proposed_actions.project_id
      WHERE proposed_actions.id = action_rejections.proposed_action_id
      AND projects.user_id = auth.uid()
    )
  );

-- RLS Policies for action_tracking
CREATE POLICY "Users can view action tracking for their projects"
  ON action_tracking FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proposed_actions
      JOIN projects ON projects.id = proposed_actions.project_id
      WHERE proposed_actions.id = action_tracking.proposed_action_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create action tracking for their projects"
  ON action_tracking FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM proposed_actions
      JOIN projects ON projects.id = proposed_actions.project_id
      WHERE proposed_actions.id = action_tracking.proposed_action_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update action tracking for their projects"
  ON action_tracking FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM proposed_actions
      JOIN projects ON projects.id = proposed_actions.project_id
      WHERE proposed_actions.id = action_tracking.proposed_action_id
      AND projects.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_tracking_updated_at BEFORE UPDATE ON action_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

