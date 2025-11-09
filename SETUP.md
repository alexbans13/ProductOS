# ProductOS Setup Guide

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://poqbhntpmoijhmfdkbec.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcWJobnRwbW9pamhtZmRrYmVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MTI1OTcsImV4cCI6MjA3ODI4ODU5N30.O03cASPWNmXg0RIA2RKa-WR71RwDTLEfAjGqbMb2caQ

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Notion OAuth
NOTION_CLIENT_ID=your_notion_client_id
NOTION_CLIENT_SECRET=your_notion_client_secret
NOTION_REDIRECT_URI=http://localhost:3000/api/data-sources/notion/callback

# App URL (for OAuth callbacks)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment variables (see above)

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Database Setup

The database schema has been created. All tables and RLS policies are in place.

### Run Database Migrations

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Navigate to SQL Editor
3. Run the migration files in order:
   - `supabase/migrations/001_initial_schema.sql` (already run)
   - `supabase/migrations/002_add_project_image.sql` (adds image_url column to projects)

### Set Up Storage Buckets

You need to create two storage buckets for image uploads:

1. **Create "project-images" bucket:**
   - Go to Storage in your Supabase dashboard
   - Click "New bucket"
   - Name: `project-images`
   - Public bucket: **Yes** (check this box)
   - Click "Create bucket"

2. **Create "avatars" bucket:**
   - Go to Storage in your Supabase dashboard
   - Click "New bucket"
   - Name: `avatars`
   - Public bucket: **Yes** (check this box)
   - Click "Create bucket"

Both buckets need to be public so images can be displayed in the app.

## Next Steps

1. Set up Notion OAuth:
   - Go to https://www.notion.so/my-integrations
   - Create a new integration
   - Copy the Client ID and Client Secret
   - Add the redirect URI: `http://localhost:3000/api/data-sources/notion/callback`
   - Update your `.env.local` file

2. Get your OpenAI API key:
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Add it to your `.env.local` file

