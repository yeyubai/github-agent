-- Phase A: Foundation schema
-- Run this in your Supabase SQL Editor

-- Users table (one per GitHub account)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table (one per browser session)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, client_id)
);

-- Messages table (LangChain conversation messages)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'human', 'ai', 'tool')),
  content TEXT NOT NULL,
  tool_call_id TEXT,
  tool_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User configs (customizable system prompt)
CREATE TABLE IF NOT EXISTS user_configs (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT '你是 GitHub Agent，一个帮助用户管理 GitHub 仓库、PR、Issue 的助手。',
  tool_description TEXT NOT NULL,
  workflow TEXT NOT NULL,
  reply_style TEXT NOT NULL DEFAULT '回复风格：简洁、专业、有帮助性。用中文回复。涉及代码时使用 Markdown 代码块。',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_configs ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (id = (SELECT id FROM users LIMIT 1));

CREATE POLICY "Users can manage own sessions" ON sessions
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));

CREATE POLICY "Users can manage own messages" ON messages
  FOR ALL USING (session_id IN (SELECT id FROM sessions WHERE user_id = (SELECT id FROM users LIMIT 1)));

CREATE POLICY "Users can manage own configs" ON user_configs
  FOR ALL USING (user_id = (SELECT id FROM users LIMIT 1));
