# Setup Instructions

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google Gemini API
GOOGLE_API_KEY=your_gemini_api_key_here

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Supabase Setup

1. Create a new Supabase project
2. Run the following SQL in the Supabase SQL editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- gesprekken
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id),
  title text DEFAULT 'Financieel gesprek',
  created_at timestamp DEFAULT now()
);

-- chatberichten
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  role text CHECK (role IN ('user', 'assistant')),
  content text,
  created_at timestamp DEFAULT now()
);

-- Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages from own conversations
CREATE POLICY "Users can view messages from own conversations"
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
);

-- Users can insert messages in own conversations
CREATE POLICY "Users can insert messages in own conversations"
ON messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
);

-- Users can update own messages
CREATE POLICY "Users can update own messages"
ON messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
);

-- Users can delete own messages
CREATE POLICY "Users can delete own messages"
ON messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM conversations c
    WHERE c.id = conversation_id
    AND c.user_id = auth.uid()
  )
);

-- Enable RLS on conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Users can view own conversations
CREATE POLICY "Users can view own conversations"
ON conversations
FOR SELECT
USING ( auth.uid() = user_id );

-- Users can insert own conversations
CREATE POLICY "Users can insert own conversations"
ON conversations
FOR INSERT
WITH CHECK ( auth.uid() = user_id );

-- Users can update own conversations
CREATE POLICY "Users can update own conversations"
ON conversations
FOR UPDATE
USING ( auth.uid() = user_id );

-- Users can delete own conversations
CREATE POLICY "Users can delete own conversations"
ON conversations
FOR DELETE
USING ( auth.uid() = user_id );
```

3. Configure authentication in Supabase:
   - Go to Authentication > Settings
   - Enable email confirmations
   - Set redirect URLs to include your domain

## Installation

```bash
npm install
npm run dev
```

## Features

- **Authentication**: Only @ficare.nl and @innoworks.ai email addresses allowed
- **Chat Persistence**: All conversations are saved to Supabase
- **AI Integration**: Google Gemini 2.5 Flash for financial analysis
- **Financial Tools**: Complete financial reporting and analysis
