# Aura Sovereign Cloud: Supabase Setup Guide

To connect your Aura Wallet to the cloud, you need to set up a Supabase project. This guide takes you through the configuration steps.

## 1. Create a Supabase Project
1. Go to [Supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **API Key** (Anon Key).
3. **Important**: Set a strong **Database Password** and keep it safe.

## 2. Initialize Database Schema
1. Go to the **SQL Editor** in your Supabase Dashboard.
2. Copy the contents of [`database_schema.sql`](./database_schema.sql) and run it.
3. This will create the necessary tables, security policies, and reward triggers.

## 3. Configure API Keys
1. In the Supabase Dashboard, go to **Project Settings** > **API**.
2. Copy the **Project URL** and **Anon Key**.
3. Create a `.env.local` file in your `aura-wallet-ledger/web` directory:
   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

## 4. Deploy Reward Distribution (Optional for Home Nodes)
If you want your cloud project to distribute rewards autonomously:
1. Install Supabase CLI: `npm install supabase --save-dev`.
2. Link your project: `npx supabase link --project-ref your_project_ref`.
3. Deploy function: `npx supabase functions deploy calculate-rewards --no-verify-jwt`.
4. Schedule the job using the Cron SQL script provided in the walkthrough.

## 5. Security Check
- Ensure **Row Level Security (RLS)** is enabled for all tables.
- Never share your **Service Role Key** or **Database Password** publicly.

---
**Aura Core Foundation**
Technical Support & Integration
