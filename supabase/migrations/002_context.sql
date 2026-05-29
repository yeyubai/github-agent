-- Phase B: Context awareness schema

-- User context (current repo, preferences, etc.)
CREATE TABLE IF NOT EXISTS user_context (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_repo TEXT,              -- e.g., "owner/repo" user is viewing
  current_pr_number INTEGER,       -- PR number if viewing a PR
  current_issue_number INTEGER,    -- Issue number if viewing an issue
  preferences JSONB DEFAULT '{}',  -- user preferences (e.g., default_limit, preferred_merge_method)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log (for analytics and "what did I do today" features)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,            -- e.g., "viewed_repo", "created_issue", "merged_pr"
  details JSONB,                   -- action-specific data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

-- Enable RLS
ALTER TABLE user_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own context" ON user_context
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));

CREATE POLICY "Users can view own activity" ON activity_log
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));
