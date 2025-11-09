export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      data_sources: {
        Row: {
          id: string
          project_id: string
          type: 'notion' | 'jira' | 'slack' | 'other'
          credentials: Json | null
          oauth_token: string | null
          status: 'connected' | 'disconnected' | 'error'
          connected_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          type: 'notion' | 'jira' | 'slack' | 'other'
          credentials?: Json | null
          oauth_token?: string | null
          status?: 'connected' | 'disconnected' | 'error'
          connected_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: 'notion' | 'jira' | 'slack' | 'other'
          credentials?: Json | null
          oauth_token?: string | null
          status?: 'connected' | 'disconnected' | 'error'
          connected_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      agents: {
        Row: {
          id: string
          project_id: string
          name: string
          type: 'user_persona' | 'marketing' | 'competitive_intel' | 'researcher' | 'designer' | 'analyst' | 'ceo_cpo' | 'custom'
          system_prompt: string
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          type: 'user_persona' | 'marketing' | 'competitive_intel' | 'researcher' | 'designer' | 'analyst' | 'ceo_cpo' | 'custom'
          system_prompt: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          type?: 'user_persona' | 'marketing' | 'competitive_intel' | 'researcher' | 'designer' | 'analyst' | 'ceo_cpo' | 'custom'
          system_prompt?: string
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      agent_runs: {
        Row: {
          id: string
          project_id: string
          run_type: 'data_refresh' | 'agent_analysis' | 'final_synthesis'
          status: 'pending' | 'running' | 'completed' | 'failed'
          started_at: string | null
          completed_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          run_type: 'data_refresh' | 'agent_analysis' | 'final_synthesis'
          status?: 'pending' | 'running' | 'completed' | 'failed'
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          run_type?: 'data_refresh' | 'agent_analysis' | 'final_synthesis'
          status?: 'pending' | 'running' | 'completed' | 'failed'
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
      agent_outputs: {
        Row: {
          id: string
          agent_run_id: string
          agent_id: string
          output_text: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          agent_run_id: string
          agent_id: string
          output_text: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          agent_run_id?: string
          agent_id?: string
          output_text?: string
          metadata?: Json | null
          created_at?: string
        }
      }
      proposed_actions: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string
          justification: string
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description: string
          justification: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string
          justification?: string
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
      }
      action_rejections: {
        Row: {
          id: string
          proposed_action_id: string
          rejection_reason: string
          created_at: string
        }
        Insert: {
          id?: string
          proposed_action_id: string
          rejection_reason: string
          created_at?: string
        }
        Update: {
          id?: string
          proposed_action_id?: string
          rejection_reason?: string
          created_at?: string
        }
      }
      action_tracking: {
        Row: {
          id: string
          proposed_action_id: string
          status: 'active' | 'completed'
          comments: string | null
          success_score: number | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          proposed_action_id: string
          status?: 'active' | 'completed'
          comments?: string | null
          success_score?: number | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          proposed_action_id?: string
          status?: 'active' | 'completed'
          comments?: string | null
          success_score?: number | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}

