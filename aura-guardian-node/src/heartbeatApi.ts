import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.post('/heartbeat', async (req, res) => {
  try {
    const { address, incrementMinutes } = req.body;
    
    if (!address || !incrementMinutes) {
      return res.status(400).json({ error: 'Missing address or incrementMinutes' });
    }

    const today = new Date().toISOString().split('T')[0];
    const safeAddress = address.toLowerCase();

    // Call the RPC function we added to Supabase
    const { error } = await supabase.rpc('heartbeat_increment', {
      p_address: safeAddress,
      p_day: today,
      p_minutes: incrementMinutes
    });

    if (error) {
      console.error('[Heartbeat Server] Supabase RPC Error:', error);
      return res.status(500).json({ error: 'Database update failed' });
    }

    console.log(`[Heartbeat] Upsert successful for ${safeAddress.slice(0, 8)} (+${incrementMinutes}m)`);
    return res.status(200).json({ ok: true, address: safeAddress, added: incrementMinutes });
    
  } catch (err) {
    console.error('[Heartbeat Server] Unexpected Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🟢 Aura Heartbeat API listening on port ${PORT}`);
  console.log(`🔌 Connect wallet to http://localhost:${PORT}/heartbeat`);
});
