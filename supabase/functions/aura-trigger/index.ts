import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const GITHUB_TOKEN = Deno.env.get('GITHUB_PAT');
    const REPO_OWNER = 'pongkonpkl'; 
    const REPO_NAME = 'Aura--AUR-';

    if (!GITHUB_TOKEN) {
      return new Response(JSON.stringify({ error: 'GITHUB_PAT not found in secrets' }), { status: 500 });
    }

    // Trigger GitHub Repository Dispatch
    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'cloud_tx', // Must match validator.yml
        client_payload: {
          trigger_source: 'supabase_edge_function',
          timestamp: new Date().toISOString()
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: 'Failed to trigger GitHub', detail: errText }), { status: 500 });
    }

    return new Response(JSON.stringify({ message: 'Aura Turbo Triggered Successfully!' }), { 
      headers: { "Content-Type": "application/json" },
      status: 200 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
})
