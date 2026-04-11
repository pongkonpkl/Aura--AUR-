import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const AUR_TOTAL_DAILY = BigInt("1000000000000000000"); // 1 AUR per day total pool
const AUR_HOURLY = AUR_TOTAL_DAILY / BigInt(24);

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    console.log("Triggering hourly reward distribution...");

    // 1. Find users active in the last 1 hour (Proof of Presence)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: activeLogs } = await supabase
      .from('mining_logs')
      .select('user_id')
      .gt('created_at', oneHourAgo);

    const activeUserIds = [...new Set(activeLogs?.map(l => l.user_id) || [])];
    
    // 2. Find users who are staking (Proof of Stake)
    const { data: stakers } = await supabase
      .from('stakes')
      .select('user_id, amount')
      .gt('amount', 0);

    const totalStakers = stakers?.length || 0;
    const totalActiveNodes = activeUserIds.length;

    console.log(`Active Nodes: ${totalActiveNodes}, Stakers: ${totalStakers}`);

    // 3. Distribution Pools (PoP 80% / PoS 20%)
    const popPool = (AUR_HOURLY * BigInt(80)) / BigInt(100);
    const posPool = (AUR_HOURLY * BigInt(20)) / BigInt(100);

    // --- PoP Rewards ---
    if (totalActiveNodes > 0) {
      const perNode = popPool / BigInt(totalActiveNodes);
      for (const uid of activeUserIds) {
        await supabase.rpc('increment_accumulated', { user_id: uid, amount: perNode.toString() });
        await supabase.from('distributions').insert({
          recipient_address: uid,
          amount: perNode.toString(),
          event_type: 'POP'
        });
      }
    }

    // --- PoS Rewards ---
    if (totalStakers > 0) {
      const perStaker = posPool / BigInt(totalStakers);
      for (const s of stakers!) {
        await supabase.rpc('increment_pending_stake', { user_id: s.user_id, amount: perStaker.toString() });
        await supabase.from('distributions').insert({
          recipient_address: s.user_id,
          amount: perStaker.toString(),
          event_type: 'POS'
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      nodes_rewarded: totalActiveNodes, 
      stakers_rewarded: totalStakers 
    }), {
      headers: { "Content-Type": "application/json" },
    })

  } catch (error) {
    console.error("Reward calculation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
