import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL || "", process.env.SUPABASE_SERVICE_KEY || "");
const targetAddress = "nrkeA6qxczkzsCsSt5eTvhA8GTSg183xjTW2Ro65PAjoMfE1TB";
const today = new Date().toISOString().split("T")[0];

async function mock() {
    console.log(`🧪 Mocking 180 minutes of uptime for ${targetAddress} on ${today}...`);
    
    // 1. Ensure account exists
    await supabase.from("aura_accounts").upsert({ address: targetAddress, public_key: "MOCK_KEY" });
    
    // 2. Insert/Update Uptime
    const { error } = await supabase.from("daily_uptime_logs").upsert({
        address: targetAddress,
        date_key: today,
        uptime_minutes: 180
    });

    if (error) {
        console.error("❌ Mock failed:", error);
    } else {
        console.log("✅ Mock uptime created. Ready for distribution test!");
    }
}

mock();
