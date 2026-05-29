-- Phase C: Reports and generated content storage

-- Generated reports (weekly/daily reports, summaries)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'code_summary', 'todo')),
  title TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',  -- date range, repos covered, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_type ON reports(user_id, type);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reports" ON reports
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));
