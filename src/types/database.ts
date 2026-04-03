export type ProjectRow = {
  id: string
  user_id: string
  github_username: string
  project_name: string
  description: string
  shipped_when: string
  repo_url: string
  repo_full_name: string
  stake_amount: number
  stake_status: string
  status: string
  proof_url: string | null
  stripe_session_id: string | null
  payment_intent_id: string | null
  created_at: string
  deadline: string
}

export type ProjectInsert = {
  id?: string
  user_id: string
  github_username: string
  project_name: string
  description: string
  shipped_when: string
  repo_url: string
  repo_full_name: string
  stake_amount: number
  stake_status?: string
  status?: string
  proof_url?: string | null
  stripe_session_id?: string | null
  payment_intent_id?: string | null
  created_at?: string
  deadline?: string
}

export type CommitRow = {
  id: string
  project_id: string
  sha: string
  message: string
  committed_at: string
  created_at: string
}

export type CommitInsert = {
  id?: string
  project_id: string
  sha: string
  message: string
  committed_at: string
  created_at?: string
}

export type CheckinInsert = {
  project_id: string
  user_id: string
  content: string
}

export type PoolRow = {
  id: string
  month: string
  total_amount: number
  status: string
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: ProjectRow
        Insert: ProjectInsert
        Update: Partial<ProjectInsert>
        Relationships: []
      }
      commits: {
        Row: CommitRow
        Insert: CommitInsert
        Update: Partial<CommitInsert>
        Relationships: []
      }
      checkins: {
        Row: {
          id: string
          project_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: CheckinInsert
        Update: Partial<CheckinInsert>
        Relationships: []
      }
      pools: {
        Row: PoolRow
        Insert: {
          id?: string
          month: string
          total_amount?: number
          status?: string
          created_at?: string
        }
        Update: Partial<{
          month: string
          total_amount: number
          status: string
          created_at: string
        }>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_pool_entry_fee: {
        Args: { p_month: string }
        Returns: undefined
      }
      create_project_from_stripe_webhook: {
        Args: {
          p_stripe_session_id: string
          p_payment_intent_id: string | null
          p_user_id: string
          p_github_username: string
          p_project_name: string
          p_description: string
          p_shipped_when: string
          p_repo_url: string
          p_repo_full_name: string
          p_pool_month: string
        }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
