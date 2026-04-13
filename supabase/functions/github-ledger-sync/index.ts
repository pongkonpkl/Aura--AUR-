import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const { record } = await req.json()
    
    // Only sync successful transactions
    if (record.status !== 'success') {
      return new Response("Not a successful transaction", { status: 200 })
    }

    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN')
    const REPO_OWNER = 'pongkonpkl'
    const REPO_NAME = 'Aura--AUR-'
    const FILE_PATH = 'ledger.json'

    if (!GITHUB_TOKEN) {
      return new Response("GITHUB_TOKEN missing", { status: 500 })
    }

    // 1. Get current ledger file content
    const getFileUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`
    const fileResp = await fetch(getFileUrl, {
      headers: { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
    })

    let sha = ''
    let ledger = { history: [] }

    if (fileResp.ok) {
      const fileData = await fileResp.json()
      sha = fileData.sha
      const content = atob(fileData.content)
      ledger = JSON.parse(content)
    }

    // 2. Append new transaction to history
    const entry = {
      id: record.id,
      tx_hash: record.tx_hash,
      from_address: record.from_address,
      to_address: record.to_address,
      amount_atom: record.amount,
      tx_type: record.tx_type,
      created_at: record.created_at,
      cloud_validated: true
    }

    ledger.history.unshift(entry)
    // Keep ledger to a reasonable size if needed, but for now just append
    
    const updatedContent = btoa(JSON.stringify(ledger, null, 2))

    // 3. Commit to GitHub
    const putResp = await fetch(getFileUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Sync TX: ${record.tx_hash || record.id}`,
        content: updatedContent,
        sha: sha
      })
    })

    if (!putResp.ok) {
      const err = await putResp.text()
      return new Response(`GitHub Update Failed: ${err}`, { status: 500 })
    }

    return new Response("Ledger Synced to GitHub", { status: 200 })

  } catch (err) {
    return new Response(err.message, { status: 500 })
  }
})
