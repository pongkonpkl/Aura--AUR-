import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call the SQL RPC function
    const { data, error } = await supabase.rpc('rpc_distribute_rewards')

    if (error) {
      throw error
    }

    return new Response(JSON.stringify({ 
      message: "Daily rewards distributed successfully", 
      result: data 
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})
