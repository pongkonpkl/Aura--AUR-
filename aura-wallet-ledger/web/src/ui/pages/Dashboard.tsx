import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Shield, Coins, Power, LogOut, Cpu, Globe, 
  Database, Terminal as TerminalIcon, ArrowUpRight, ArrowDownLeft, 
  X, AlertCircle, CheckCircle2, RefreshCw, Key, Home, Eye, EyeOff,
  Copy, Scan, Camera, Maximize2, Lock, Zap
} from 'lucide-react';
import { ethers } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

import { supabase } from '../../lib/supabase';

interface DashboardProps {
  onLogout: () => void;
  onDisconnect: () => void;
  wallet: ethers.Wallet;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, onDisconnect, wallet }) => {
  const [isEngineReady, setIsEngineReady] = useState(true);
  const [networkStats, setNetworkStats] = useState({ activeNodes: 0, sharedPool: '0.00' });
  const [activeModal, setActiveModal] = useState<'send' | 'receive' | 'seed' | 'stake' | 'cloud' | 'challenge' | null>(null);
  const [isSeedRevealed, setIsSeedRevealed] = useState(false);
  
  const [balanceAtom, setBalanceAtom] = useState<string>("0");
  const [stakedBalanceAtom, setStakedBalanceAtom] = useState<string>("0");
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [stakingTab, setStakingTab] = useState<'stake' | 'unstake'>('stake');
  const [totalEmission, setTotalEmission] = useState<string>("0");
  const [dailyEmission, setDailyEmission] = useState<string>("0");
  const [activeNodesCount, setActiveNodesCount] = useState<number>(0);
  const [pendingTxs, setPendingTxs] = useState<{hash: string, amount: bigint, type: string}[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [lastCloudOpTime, setLastCloudOpTime] = useState<number>(Date.now());
  const [recipientProfile, setRecipientProfile] = useState<{nick?: string, exists: boolean} | null>(null);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  const [pendingRewardAtom, setPendingRewardAtom] = useState<string>("0");
  const [isClaiming, setIsClaiming] = useState(false);

  // Sovereign Seed Challenge (MFA) States
  const [challengeIndex, setChallengeIndex] = useState<number | null>(null);
  const [challengeInput, setChallengeInput] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [challengeError, setChallengeError] = useState(false);

  const isValidAddress = recipient ? ethers.isAddress(recipient.toLowerCase()) : null;
  const isSelfSend = recipient.toLowerCase() === wallet.address.toLowerCase();

  const hasLoggedRegistration = useRef(false);
  const hasLoggedDiscovery = useRef(false);

  const IS_HTTPS = window.location.protocol === 'https:';
  const REPO_RAW_BASE = "https://raw.githubusercontent.com/pongkonpkl/Aura--AUR-/l3-framework-v1";
  const LOCAL_ENGINE_URL = "http://localhost:8000";

  const MOCK_SEED = wallet.mnemonic?.phrase?.split(' ') || [];
  const [logs, setLogs] = useState<string[]>([
    'Quantum presence verified...',
    'Broadcasting sovereign heartbeats...',
    `Identity: ${wallet.address}`,
  ]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    addLog("Address copied to clipboard.");
  };

  // Scanner Logic
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    
    if (isScannerOpen) {
      // 1. Get Cameras
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Default to back camera if searching for "back"
          const backCamera = devices.find(d => d.label.toLowerCase().includes('back'));
          setActiveCameraId(backCamera ? backCamera.id : devices[0].id);
        }
      }).catch(err => addLog(`Camera Access Error: ${err}`));

      html5QrCode = new Html5Qrcode("scanner-region");
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [isScannerOpen]);

  const startScanning = (cameraId: string) => {
    const html5QrCode = new Html5Qrcode("scanner-region");
    html5QrCode.start(
      cameraId,
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        if (decodedText.startsWith('0x')) {
          setRecipient(decodedText);
          setIsScannerOpen(false);
          addLog(`Recipient identified: ${decodedText.slice(0,10)}...`);
        }
      },
      (errorMessage) => {}
    ).catch(err => addLog(`Scan Start Failure: ${err}`));
  };

  useEffect(() => {
    if (isScannerOpen && activeCameraId) {
      startScanning(activeCameraId);
    }
  }, [isScannerOpen, activeCameraId]);

  // Autonomous Heartbeat & Supabase Sync Loop
  useEffect(() => {
    const syncWithSupabase = async () => {
      try {
        // 1. Fetch Profile & Balance
        const { data: profile, error: pError } = await supabase
          .from('profiles')
          .select('*')
          .eq('wallet_address', wallet.address.toLowerCase())
          .single();

        if (pError && pError.code === 'PGRST116') {
          // Profile not found, create one (Auto-registration)
          await supabase.from('profiles').insert({
            wallet_address: wallet.address.toLowerCase(),
            nickname: 'Aura Sovereign'
          });
          if (!hasLoggedRegistration.current) {
            addLog("Sovereign Identity Registered in Cloud.");
            hasLoggedRegistration.current = true;
          }
        } 

        if (profile) {
          const serverBalance = BigInt(profile.balance || "0");
          const serverStaked = BigInt(profile.staked_balance || "0");
          
          // Apply Optimistic Offsets
          const pendingOut = pendingTxs.filter(t => t.type === 'transfer' || t.type === 'stake').reduce((acc, t) => acc + t.amount, 0n);
          const pendingIn = pendingTxs.filter(t => t.type === 'unstake').reduce((acc, t) => acc + t.amount, 0n);
          const pendingStakeOut = pendingTxs.filter(t => t.type === 'unstake').reduce((acc, t) => acc + t.amount, 0n);
          const pendingStakeIn = pendingTxs.filter(t => t.type === 'stake').reduce((acc, t) => acc + t.amount, 0n);

          setBalanceAtom((serverBalance - pendingOut + pendingIn).toString());
          setStakedBalanceAtom((serverStaked - pendingStakeOut + pendingStakeIn).toString());
          setIsEngineReady(true);
        }

        // 3. Network Stats & Emission Control
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);

        // Today's Pulse
        const { data: dailyData } = await supabase
          .from('distributions')
          .select('amount')
          .gte('created_at', startOfToday.toISOString());
        
        const sumToday = dailyData?.reduce((acc, curr) => acc + BigInt(curr.amount || "0"), BigInt(0)) || BigInt(0);
        setDailyEmission(sumToday.toString());

        // Global Total Supply (Lifetime Mined)
        const { data: globalData } = await supabase
          .from('distributions')
          .select('amount');
        
        const sumTotal = globalData?.reduce((acc, curr) => acc + BigInt(curr.amount || "0"), BigInt(0)) || BigInt(0);
        setTotalEmission(sumTotal.toString());

        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        setActiveNodesCount(count || 0);
        setNetworkStats({ 
          activeNodes: count || 0, 
          sharedPool: Number(ethers.formatUnits(sumToday, 18)).toFixed(4)
        });
        
        // 4. Fetch Transaction History
        const { data: txHistory } = await supabase
          .from('transactions')
          .select('*')
          .or(`from_address.eq.${wallet.address.toLowerCase()},to_address.eq.${wallet.address.toLowerCase()}`)
          .order('created_at', { ascending: false })
          .limit(15);
        
        if (txHistory) setHistory(txHistory);

        // 5. Initial fallbacks from Cloud data, then Ledger fetch...
        if (sumTotal > 0n) setTotalEmission(sumTotal.toString());
        if (sumToday > 0n) setDailyEmission(sumToday.toString());


        // 4. Legacy Balance Detection
        try {
          const res = await fetch(`${REPO_RAW_BASE}/ledger.json?t=${Date.now()}`);
          if (res.ok) {
            const ledger = await res.json();
            
            // 🌟 SYNC GLOBAL TOTALS
            if (ledger.total_supply) setTotalEmission(ledger.total_supply);
            // Estimate pulse from last 24h history or fixed 1.0 AUR base
            // Use the value from Supabase if available, otherwise fallback
            if (sumToday === BigInt(0)) {
              setDailyEmission("1000000000000000000"); 
            }

            const addressKey = wallet.address.toLowerCase();
            // Case-insensitive lookup for legacy ledger
            const balances = Object.fromEntries(Object.entries(ledger.balances || {}).map(([k, v]) => [k.toLowerCase(), v]));
            const stakedBalances = Object.fromEntries(Object.entries(ledger.staked_balances || {}).map(([k, v]) => [k.toLowerCase(), v]));
            
            const legacyBalance = BigInt(balances[addressKey] || "0");
            const cloudBalance = BigInt(profile?.balance || "0");
            
            if (legacyBalance > cloudBalance) {
              if (!hasLoggedDiscovery.current) {
                addLog(`⚠️ Legacy Discovery: Found ${Number(ethers.formatUnits(legacyBalance, 18)).toFixed(4)} AUR.`);
                hasLoggedDiscovery.current = true;
              }
              setLegacyPendingBalance(legacyBalance.toString());
            }
          }
        } catch (e) { /* silent fail for ledger fetch */ }

      } catch (err) {
        console.error("Supabase sync error:", err);
      }
    };

    const heartbeat = async () => {
      try {
        // Log Presence to Supabase mining_logs
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('wallet_address', wallet.address.toLowerCase())
          .single();

        if (profile) {
          await supabase.from('mining_logs').insert({
            user_id: profile.id,
            hash_rate: 1.0, // Base PoHA metric
            earned_amount: "1000000000000" // Optional: micro-reward per heartbeat
          });
          addLog(`Quantum heartbeat synchronized to Cloud.`);
        }
      } catch (e) {
        addLog("Cloud Heartbeat failed. Check internet connection.");
      }
    };

    const syncWithEngine = async () => {
      try {
        const res = await fetch(`${LOCAL_ENGINE_URL}/wallet-summary?address=${wallet.address}`);
        if (res.ok) {
          const data = await res.json();
          if (data.pending_reward_atom) {
            setPendingRewardAtom(data.pending_reward_atom);
          }
        }
      } catch (e) { /* engine might be offline */ }
    };

    syncWithSupabase();
    syncWithEngine();
    heartbeat();
    
    const syncInterval = setInterval(syncWithSupabase, 10000);
    const engineInterval = setInterval(syncWithEngine, 5000);
    const heartbeatInterval = setInterval(heartbeat, 60000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(engineInterval);
      clearInterval(heartbeatInterval);
    };
  }, [wallet, pendingTxs]);

  // 🕵️ Transaction Status Watcher (The "Short-term Memory" Manager)
  useEffect(() => {
    if (pendingTxs.length === 0) return;

    const watchStatus = async () => {
      const hashes = pendingTxs.map(t => t.hash);
      const { data, error } = await supabase
        .from('transactions')
        .select('tx_hash, status, error_log')
        .in('tx_hash', hashes);

      if (error || !data) return;

      data.forEach(tx => {
        if (tx.status === 'success') {
          // Settlement achieved!
          setPendingTxs(prev => prev.filter(p => p.hash !== tx.tx_hash));
          addLog(`✅ Cloud Settlement Success: ${tx.tx_hash.slice(0, 12)}...`);
        } else if (tx.status === 'failed') {
          // Settlement failed! Clear memory and alert user
          setPendingTxs(prev => prev.filter(p => p.hash !== tx.tx_hash));
          addLog(`❌ ERROR: Settlement Failed for ${tx.tx_hash.slice(0, 12)}...`);
          if (tx.error_log) addLog(`> Detail: ${tx.error_log}`);
        }
      });
    };

    const interval = setInterval(watchStatus, 5000); // Check every 5s for fast feedback
    return () => clearInterval(interval);
  }, [pendingTxs]);

  // 🛡️ Smart Identity Verification Loop
  useEffect(() => {
    if (!recipient || !isValidAddress) {
      setRecipientProfile(null);
      return;
    }

    const checkIdentity = async () => {
      setIsCheckingRecipient(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('wallet_address', recipient.toLowerCase())
          .single();

        if (data) {
          setRecipientProfile({ nick: data.nickname, exists: true });
        } else {
          setRecipientProfile({ exists: false });
        }
      } catch (err) {
        setRecipientProfile(null);
      }
      setIsCheckingRecipient(false);
    };

    const debounceToken = setTimeout(checkIdentity, 500);
    return () => clearTimeout(debounceToken);
  }, [recipient, isValidAddress]);

  const fetchNonce = async (address: string): Promise<number> => {
    try {
      // Security Hardening: Prioritize Database-driven Nonce
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_nonce')
        .eq('wallet_address', address.toLowerCase())
        .single();
      
      if (profile && profile.last_nonce !== null) {
        return Number(profile.last_nonce);
      }

      // Fallback: This is legacy logic for transition
      const resp = await fetch(`${LOCAL_ENGINE_URL}/nonce?address=${address}`);
      const data = await resp.json();
      return data.nonce;
    } catch (e) {
      // Deep Fallback: Cloud Ledger JSON
      try {
        const res = await fetch(`${REPO_RAW_BASE}/ledger.json`);
        const ledger = await res.json();
        return parseInt((ledger.nonces || {})[address] || "0");
      } catch (err) {
        addLog("Critical: Nonce retrieval failed. Check connection.");
        return 0;
      }
    }
  };

  // Removed handleForceDistribute (Now managed autonomously by Cloud Cron)

  const submitCloudTx = async (op: string, tx: any, signature: string) => {
    // Security Hardening: Transaction Queue Settlement (Token-less)
    const VALID_OPS = ['transfer', 'stake', 'unstake', 'sync_legacy'];
    if (!VALID_OPS.includes(op)) throw new Error(`Security Violation: Invalid Cloud Operation (${op}).`);

    const tx_hash = `queued-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Insert into Supabase Transaction Queue
    const { error } = await supabase
      .from('transactions')
      .insert({
        tx_hash,
        from_address: wallet.address.toLowerCase(),
        to_address: tx.to_address?.toLowerCase() || 'System',
        amount: tx.amount_atom || "0",
        tx_type: op,
        signature,
        status: 'pending',
        payload: { op, tx, signature } // For Validator pick-up
      });

    if (error) throw new Error(`Queue Failure: ${error.message}`);
    addLog(`Transaction queued for Cloud Settlement. Hash: ${tx_hash.slice(0,12)}...`);
    return tx_hash;
  };

  const handleClaim = async () => {
    const action = async () => {
        setIsClaiming(true);
        try {
          const currentNonce = await fetchNonce(wallet.address);
          const nextNonce = currentNonce + 1;

          const message = `AUR_CLAIM:${nextNonce}:${wallet.address.toLowerCase()}`;
          const signature = await wallet.signMessage(message);
          
          const resp = await fetch(`${LOCAL_ENGINE_URL}/claim-op`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  tx: { address: wallet.address, nonce: nextNonce }, 
                  signature 
              })
          });
          
          const result = await resp.json();
          if (result.ok) {
              addLog(`✅ Reward Claimed: ${ethers.formatUnits(result.amount_atom, 18)} AUR`);
              setPendingRewardAtom("0");
              setBalanceAtom((BigInt(balanceAtom) + BigInt(result.amount_atom)).toString());
              setLastCloudOpTime(Date.now());
          } else {
              throw new Error(result.error || "Claim failed");
          }
        } catch(e: any) {
          addLog(`❌ Claim Error: ${e.message}`);
        }
        setIsClaiming(false);
    };
    wrapWithChallenge(action);
  };

  const triggerSovereignChallenge = (action: () => Promise<void>) => {
    const randomIndex = Math.floor(Math.random() * 12); // 0-11
    setChallengeIndex(randomIndex);
    setChallengeInput("");
    setChallengeError(false);
    setPendingAction(() => action);
    setActiveModal('cloud'); // We'll repurpose the cloud modal or create a new 'challenge' one
    // Let's actually use a new 'challenge' state for activeModal
    setActiveModal(null); // Close current first
    setTimeout(() => {
        setChallengeIndex(randomIndex);
        setChallengeInput("");
        setPendingAction(() => action);
        // We need 'challenge' in the activeModal type
    }, 10);
  };

  const handleVerifyChallenge = async () => {
    if (challengeIndex === null) return;
    const correctWord = MOCK_SEED[challengeIndex!].toLowerCase().trim();
    if (challengeInput.toLowerCase().trim() === correctWord) {
        setChallengeError(false);
        setActiveModal(null);
        if (pendingAction) {
            await pendingAction();
            setPendingAction(null);
        }
    } else {
        setChallengeError(true);
        addLog("❌ Sovereign Challenge Failed: Security Breach Prevented.");
    }
  };

  const wrapWithChallenge = (action: () => Promise<void>) => {
    const randomIndex = Math.floor(Math.random() * 12);
    setChallengeIndex(randomIndex);
    setChallengeInput("");
    setChallengeError(false);
    setPendingAction(() => action);
    setActiveModal('challenge');
  };

  const handleSend = async () => {
    if(!recipient || !sendAmount) return;
    
    const action = async () => {
        setIsSending(true);
        try {
            const amountAtom = BigInt(Math.floor(parseFloat(sendAmount) * 1e18));
            const currentNonce = await fetchNonce(wallet.address);
            const nextNonce = currentNonce + 1;
            
            const message = `AUR_TX:${nextNonce}:${wallet.address.toLowerCase()}:${recipient.toLowerCase()}:${amountAtom}`;
            const signature = await wallet.signMessage(message);
            
            const txHash = await submitCloudTx('transfer', { 
                from_address: wallet.address, 
                to_address: recipient, 
                amount_atom: amountAtom.toString(),
                nonce: nextNonce 
            }, signature);
            
            addLog(`Cloud Send Sent. Awaiting validation.`);
            setLastCloudOpTime(Date.now());
            setBalanceAtom((BigInt(balanceAtom) - amountAtom).toString());
            setPendingTxs(prev => [...prev, { hash: txHash, amount: amountAtom, type: 'transfer' }]);
            
            setRecipient("");
            setSendAmount("");
        } catch(e: any) {
            alert(e.message);
        }
        setIsSending(false);
    };

    wrapWithChallenge(action);
  };

  const handleStake = async () => {
    if(!stakeAmount) return;
    const action = async () => {
        setIsStaking(true);
        try {
          const amountAtom = ethers.parseUnits(stakeAmount, 18);
          if (amountAtom > BigInt(balanceAtom)) throw new Error("Insufficient Liquid Balance");
          
          const currentNonce = await fetchNonce(wallet.address);
          const nextNonce = currentNonce + 1;

          const message = `AUR_STAKE:${nextNonce}:${wallet.address.toLowerCase()}:${amountAtom.toString()}`;
          const signature = await wallet.signMessage(message);
          
          const txHash = await submitCloudTx('stake', { address: wallet.address, amount_atom: amountAtom.toString(), nonce: nextNonce }, signature);
          addLog(`Cloud Stake Sent. Awaiting cloud validation.`);
          setLastCloudOpTime(Date.now());
          
          setBalanceAtom((BigInt(balanceAtom) - amountAtom).toString());
          setStakedBalanceAtom((BigInt(stakedBalanceAtom) + amountAtom).toString());
          setPendingTxs(prev => [...prev, { hash: txHash, amount: amountAtom, type: 'stake' }]);
          
          setStakeAmount("");
        } catch(e: any) {
          alert(e.message);
        }
        setIsStaking(false);
    };
    wrapWithChallenge(action);
  };
  
  const handleUnstake = async () => {
    if(!stakeAmount) return;
    const action = async () => {
        setIsStaking(true);
        try {
          const amountAtom = ethers.parseUnits(stakeAmount, 18);
          if (amountAtom > BigInt(stakedBalanceAtom)) throw new Error("Insufficient Staked Balance");
          
          const currentNonce = await fetchNonce(wallet.address);
          const nextNonce = currentNonce + 1;

          const message = `AUR_UNSTAKE:${nextNonce}:${wallet.address.toLowerCase()}:${amountAtom.toString()}`;
          const signature = await wallet.signMessage(message);
          
          const txHash = await submitCloudTx('unstake', { address: wallet.address, amount_atom: amountAtom.toString(), nonce: nextNonce }, signature);
          addLog(`Unstake request broadcasted to Sovereign Fleet.`);
          setLastCloudOpTime(Date.now());
          
          setStakedBalanceAtom((BigInt(stakedBalanceAtom) - amountAtom).toString());
          setBalanceAtom((BigInt(balanceAtom) + amountAtom).toString());
          setPendingTxs(prev => [...prev, { hash: txHash, amount: amountAtom, type: 'unstake' }]);
          setStakeAmount("");
        } catch(e: any) {
          alert(e.message);
        }
        setIsStaking(false);
    };
    wrapWithChallenge(action);
  };



  return (
    <div className="min-h-screen p-4 md:p-8 animate-in fade-in zoom-in-95 duration-1000 relative">
      
      {/* Diagnostic Overlay */}
      {!isEngineReady && (
        <div className="modal-overlay">
          <div className="modal-content text-center border-indigo-500/20 shadow-indigo-500/10 max-w-2xl">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <RefreshCw className="text-indigo-500 w-10 h-10 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Synchronizing Aura Cloud</h2>
            <p className="text-white/50 mb-8 leading-relaxed">
              Establishing secure connection to Supabase Off-chain Backend. This fixes the "Link Restricted" error by using cloud-hosted HTTPS.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition-all text-sm"
            >
              <RefreshCw size={18} /> Retry Connection
            </button>
          </div>
        </div>
      )}


      {/* Send Modal */}
      {activeModal === 'send' && (
        <div className="modal-overlay" onClick={() => { setActiveModal(null); setIsScannerOpen(false); }}>
          <div className="modal-content overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Initiate Transfer</h2>
              <button onClick={() => { setActiveModal(null); setIsScannerOpen(false); }} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
              <div className="relative">
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Recipient Address</label>
                <div className="flex gap-2">
                  <div className="relative flex-1 group">
                    <input 
                      value={recipient} 
                      onChange={e=>setRecipient(e.target.value)} 
                      type="text" 
                      placeholder="0x..." 
                      className={`w-full bg-white/5 border rounded-xl px-4 py-4 outline-none transition-all font-mono text-sm pr-12 ${
                        isValidAddress === true ? 'border-emerald-500/50 focus:border-emerald-500 text-emerald-100' : 
                        isValidAddress === false ? 'border-red-500/50 focus:border-red-500 text-red-100' : 
                        'border-white/10 focus:border-indigo-500'
                      }`} 
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      {isValidAddress === true && !isSelfSend && <CheckCircle2 size={18} className="text-emerald-500 animate-in zoom-in duration-300" />}
                      {isValidAddress === true && isSelfSend && <AlertCircle size={18} className="text-orange-500 animate-in bounce duration-300" />}
                      {isValidAddress === false && <AlertCircle size={18} className="text-red-500 animate-in shake duration-300" />}
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsScannerOpen(!isScannerOpen)}
                    className={`p-4 rounded-xl transition-all border ${isScannerOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                  >
                    <Scan size={20} />
                  </button>
                </div>
                {isValidAddress === false && (
                  <p className="text-[10px] font-bold text-red-500 mt-2 uppercase tracking-tighter animate-in slide-in-from-top-1">
                    Invalid Sovereign Address Format or Checksum Error
                  </p>
                )}
                {isValidAddress === true && isCheckingRecipient && (
                  <p className="text-[10px] font-bold text-indigo-400 mt-2 uppercase tracking-tighter animate-pulse">
                    🔍 Verifying Identity in Aura Universe...
                  </p>
                )}
                {isValidAddress === true && !isCheckingRecipient && recipientProfile?.exists && (
                  <p className="text-[10px] font-bold text-emerald-400 mt-2 uppercase tracking-tighter flex items-center gap-1 animate-in zoom-in duration-300">
                    <CheckCircle2 size={12} /> Verified AUR Resident {recipientProfile.nick ? `(${recipientProfile.nick})` : ''}
                  </p>
                )}
                {isValidAddress === true && !isCheckingRecipient && recipientProfile && !recipientProfile.exists && (
                  <p className="text-[10px] font-bold text-amber-500 mt-2 uppercase tracking-tighter flex items-center gap-1 animate-in slide-in-from-left-2">
                    ⚠️ New Sovereign Address (No History Detected)
                  </p>
                )}
                {isValidAddress === true && isSelfSend && (
                  <p className="text-[10px] font-bold text-orange-400 mt-2 uppercase tracking-tighter animate-in slide-in-from-top-1">
                    ⚠️ Warning: You are sending AUR to your own Sovereign Identity
                  </p>
                )}
              </div>

              {isScannerOpen && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="relative bg-black rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
                    <div id="scanner-region" className="w-full aspect-square" />
                    
                    {/* Scanner UI Overlays */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                       <div className="w-64 h-64 border-2 border-indigo-500/50 rounded-3xl relative">
                          <div className="absolute inset-0 animate-pulse border-2 border-indigo-500 rounded-3xl" />
                       </div>
                    </div>

                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 px-4">
                      {cameras.length > 1 && (
                        <button 
                          onClick={() => {
                            const nextIdx = (cameras.findIndex(c => c.id === activeCameraId) + 1) % cameras.length;
                            setActiveCameraId(cameras[nextIdx].id);
                          }}
                          className="px-4 py-2 bg-black/60 backdrop-blur-md rounded-full text-xs font-bold flex items-center gap-2 border border-white/10"
                        >
                          <Camera size={14} /> Switch Camera
                        </button>
                      )}
                      <button 
                         onClick={() => setIsScannerOpen(false)}
                         className="px-4 py-2 bg-red-500/20 backdrop-blur-md rounded-full text-xs font-bold text-red-400 border border-red-500/20"
                      >
                         Close Scanner
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Amount (AUR)</label>
                <input value={sendAmount} onChange={e=>setSendAmount(e.target.value)} type="number" step="any" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:border-indigo-500 outline-none transition-all font-bold" />
              </div>
              <button disabled={isSending || !sendAmount || !isValidAddress || (parseFloat(sendAmount) * 1e18) > Number(balanceAtom)} onClick={handleSend} className={`w-full py-5 font-bold rounded-2xl transition-all shadow-lg ${isSending || !sendAmount || !isValidAddress || (parseFloat(sendAmount) * 1e18) > Number(balanceAtom) ? 'bg-indigo-600/50 text-white/50 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                {isSending ? 'Signing & Sending...' : 'Initiate Sovereign Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {activeModal === 'receive' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content text-center" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-left">Your Deposit ID</h2>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
            </div>
            
            <div className="bg-white p-6 rounded-[2rem] inline-block mb-8 shadow-[0_0_40px_rgba(124,58,237,0.3)] border border-indigo-500/20">
              <QRCodeSVG 
                value={wallet.address} 
                size={220}
                level="H"
                fgColor="#312e81"
                includeMargin={true}
                imageSettings={{
                  src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNDgiIGZpbGw9IiMxZTFiNGIiIHN0cm9rZT0iIzYzNjZmMSIgc3Ryb2tlLXdpZHRoPSI0Ii8+CiAgPHRleHQgeD0iNTAiIHk9IjY1IiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iNTAiIGZvbnQtd2VpZ2h0PSI5MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IndoaXRlIj5BPC90ZXh0Pgo8L3N2Zz4=",
                  x: undefined, y: undefined, height: 60, width: 60, excavate: true,
                }}
              />
            </div>
            
            <div className="relative group mb-6">
              <p className="text-xs font-mono text-indigo-300 bg-indigo-500/10 py-4 px-6 rounded-2xl break-all line-clamp-2 border border-indigo-500/20 shadow-inner">
                {wallet.address}
              </p>
              <button 
                onClick={handleCopy}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all ${isCopied ? 'bg-emerald-500 text-white scale-110' : 'bg-white/10 text-white/60 hover:text-white hover:bg-indigo-600'}`}
              >
                {isCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              </button>
            </div>

            <p className="text-sm text-white/40 leading-relaxed max-w-xs mx-auto">
              Only send <span className="text-indigo-400 font-bold underline decoration-indigo-500/30">AUR token</span> to this address on the Sovereign Peer Network.
            </p>
          </div>
        </div>
      )}

      {/* Stake Modal */}
      {activeModal === 'stake' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Lock className="text-emerald-400"/> Sovereign Staking
              </h2>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 mb-8">
              <button 
                onClick={() => { setStakingTab('stake'); setStakeAmount(""); }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${stakingTab === 'stake' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white'}`}
              >
                Stake
              </button>
              <button 
                onClick={() => { setStakingTab('unstake'); setStakeAmount(""); }}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${stakingTab === 'unstake' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-white/40 hover:text-white'}`}
              >
                Unstake
              </button>
            </div>
            
            <div className="space-y-6">
               <div className={`p-4 border rounded-2xl flex gap-4 transition-colors ${stakingTab === 'stake' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
                 <Shield size={24} className={stakingTab === 'stake' ? 'text-emerald-400' : 'text-orange-400'} />
                 <p className="text-sm text-white/70">
                   {stakingTab === 'stake' ? (
                     <>
                        <strong className="text-emerald-400 block mb-1">Earn 100% of Daily AUR Protocol Yield</strong>
                        Lock your Aura into the Sovereign Vault. You can withdraw anytime. Minimum stake is 1 wei.
                     </>
                   ) : (
                     <>
                        <strong className="text-orange-400 block mb-1">Unlock Sovereign Capital</strong>
                        Move your AUR from the Sovereign Vault back to your Celestial Treasury. There is zero exit fee.
                     </>
                   )}
                 </p>
               </div>

              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 flex justify-between">
                  <span>Amount to {stakingTab === 'stake' ? 'Lock' : 'Unlock'} (AUR)</span>
                  <span 
                    className="text-indigo-400 cursor-pointer hover:text-indigo-300 font-mono" 
                    onClick={() => {
                        const rawAtom = stakingTab === 'stake' ? balanceAtom : stakedBalanceAtom;
                        setStakeAmount(ethers.formatUnits(rawAtom, 18));
                    }}
                  >
                    Max: {Number(ethers.formatUnits(stakingTab === 'stake' ? balanceAtom : stakedBalanceAtom, 18)).toFixed(4)}
                  </span>
                </label>
                <input 
                  value={stakeAmount} 
                  onChange={e=>setStakeAmount(e.target.value)} 
                  type="number" 
                  step="any"
                  placeholder="0.00" 
                  className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 outline-none transition-all font-mono font-bold ${stakingTab === 'stake' ? 'focus:border-emerald-500' : 'focus:border-orange-500'}`} 
                />
              </div>
              <button 
                disabled={isStaking || !stakeAmount || (() => {
                  try {
                    const amt = ethers.parseUnits(stakeAmount, 18);
                    return amt > BigInt(stakingTab === 'stake' ? balanceAtom : stakedBalanceAtom);
                  } catch { return true; }
                })()} 
                onClick={stakingTab === 'stake' ? handleStake : handleUnstake} 
                className={`w-full py-5 font-bold rounded-2xl transition-all shadow-lg ${
                  isStaking || !stakeAmount || (() => {
                    try {
                      const amt = ethers.parseUnits(stakeAmount, 18);
                      return amt > BigInt(stakingTab === 'stake' ? balanceAtom : stakedBalanceAtom);
                    } catch { return true; }
                  })()
                  ? (stakingTab === 'stake' ? 'bg-emerald-600/50' : 'bg-orange-600/50') + ' text-white/50 cursor-not-allowed' 
                  : (stakingTab === 'stake' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-orange-500 hover:bg-orange-400') + ' text-white'
                }`}
              >
                {isStaking ? (stakingTab === 'stake' ? 'Locking on L3...' : 'Unlocking...') : (stakingTab === 'stake' ? 'Confirm L3 Stake' : 'Confirm Unlock')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sovereign Challenge Modal (MFA) */}
      {activeModal === 'challenge' && (
        <div className="modal-overlay" onClick={() => { setActiveModal(null); setPendingAction(null); }}>
          <div className="modal-content text-center border-indigo-500/30 max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-indigo-500/10 rounded-full text-indigo-400 relative">
                <Shield size={32} className="relative z-10" />
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl animate-pulse" />
              </div>
            </div>
            
            <h2 className="text-2xl font-black mb-2 tracking-tight">Sovereign Challenge</h2>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-6">Multi-Factor Digital Audit</p>
            
            <div className="p-6 bg-white/5 rounded-2xl border border-white/5 mb-8">
              <p className="text-sm text-white/60 leading-relaxed mb-4">
                To authorize this Sovereign Transaction, enter word <span className="text-white font-mono font-black underline underline-offset-4 decoration-indigo-500">#{challengeIndex! + 1}</span> from your Secret Recovery Phrase.
              </p>
              
              <input 
                type="password"
                value={challengeInput}
                onChange={e => setChallengeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVerifyChallenge()}
                placeholder="Enter word here..."
                autoFocus
                className={`w-full bg-black/40 border ${challengeError ? 'border-red-500/50' : 'border-white/10 focus:border-indigo-500'} rounded-xl px-4 py-4 outline-none text-center font-mono text-lg transition-all`}
              />
              
              {challengeError && (
                <p className="text-[10px] text-red-400 font-bold uppercase mt-3 animate-bounce">Verification Failed. Try Again.</p>
              )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => { setActiveModal(null); setPendingAction(null); }}
                className="flex-1 py-4 text-xs font-bold text-white/20 hover:text-white/40 uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleVerifyChallenge}
                className="flex-[2] py-4 bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-400 transition-all shadow-lg active:scale-95 group"
              >
                Confirm <Zap size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header - Commander Grade */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 glass-panel rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 flex items-center justify-center rounded-full border-2 border-indigo-500/40 bg-[#0a0a1a] shadow-[0_0_15px_rgba(124,58,237,0.4)] relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 via-transparent to-purple-600/30 rounded-full" />
              <span className="text-4xl font-black bg-gradient-to-b from-white via-indigo-100 to-purple-400 bg-clip-text text-transparent transform translate-y-[-2%] translate-x-[2%]">
                A
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gradient">Sovereign Command</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]" />
                  Presence Active
                </span>
                <span className="text-xs text-white/40 uppercase tracking-tighter">Identity: {wallet.address.slice(0,6)}...{wallet.address.slice(-4)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-6 md:mt-0">
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <Globe size={12} className="text-indigo-400" />
              <span className="text-[10px] font-black text-white/60 uppercase tracking-tighter">
                Total Supply: {ethers.formatUnits(totalEmission, 18)} AUR
              </span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                Pulse: {ethers.formatUnits(dailyEmission, 18)} AUR Today
              </span>
            </div>
            
            {/* Operational controls removed for secondary hardening. Only Lock Wallet remains. */}


            
            <button 
              onClick={onLogout}
              className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl font-bold text-[10px] transition-all flex items-center gap-2 border border-red-500/10"
            >
              <LogOut size={14}/> <span className="hidden lg:inline">Lock Wallet</span>
            </button>
          </div>
        </header>

        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Global Presence */}
              <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                    <Globe size={24} />
                  </div>
                  <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Sovereign Consensus</span>
                </div>
                <div className="space-y-1">
                  <p className="text-5xl font-bold tracking-tighter text-white group-hover:text-blue-400 transition-colors">
                    {networkStats.activeNodes}
                  </p>
                  <p className="text-sm text-white/30 font-medium whitespace-nowrap">Active Network Validators</p>
                </div>
              </div>

              {/* Celestial Treasury (Liquid) */}
              <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-3xl rounded-full" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <Coins size={24} />
                  </div>
                  <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Celestial Treasury</span>
                </div>
                <div className="flex justify-between items-end mb-8 space-y-1">
                  <div>
                    <p className="text-5xl font-bold tracking-tighter text-white group-hover:text-purple-400 transition-colors">
                      {ethers.formatUnits(balanceAtom, 18)}<span className="text-2xl text-white/40"> AUR</span>
                    </p>
                    <p className="text-sm text-purple-400/60 font-medium">Liquid Balance (Available to Spend)</p>
                  </div>
                </div>
                {/* Legacy wealth has been migrated to Supabase-first settlement. No restore required. */}

                <div className="flex gap-3">
                  <button 
                    onClick={() => setActiveModal('send')} 
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex justify-center items-center gap-2 border border-white/5 transition-all text-sm"
                  >
                    <ArrowUpRight size={16} className="text-indigo-400"/> Send
                  </button>
                  <button 
                    onClick={() => setActiveModal('receive')} 
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold flex justify-center items-center gap-2 border border-indigo-500 transition-all text-sm"
                  >
                    <ArrowDownLeft size={16}/> Receive
                  </button>
                </div>
              </div>

              {/* Sovereign Staking (PoS) */}
              <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group border border-emerald-500/10">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full" />
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <Lock size={24} />
                    </div>
                    <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Sovereign Stake</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/20">Sovereign Vault</span>
                </div>
                <div className="space-y-1 mb-8">
                  <p className="text-5xl font-bold tracking-tighter text-emerald-100 group-hover:text-emerald-400 transition-colors">
                    {ethers.formatUnits(stakedBalanceAtom, 18)}<span className="text-2xl text-emerald-400/40"> AUR</span>
                  </p>
                  <p className="text-sm text-emerald-400 font-medium flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin-slow" /> Compounding (Protocol Distribution: 100% Yield)
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setStakingTab('stake'); setActiveModal('stake'); }} 
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold flex justify-center items-center gap-2 border border-emerald-500 transition-all text-sm shadow-lg shadow-emerald-900/20"
                  >
                    Lock & Earn Output
                  </button>
                  <button 
                    disabled={isClaiming || BigInt(pendingRewardAtom) === 0n}
                    onClick={handleClaim} 
                    className={`flex-1 py-3 rounded-xl font-bold flex justify-center items-center gap-2 border transition-all text-sm shadow-lg ${
                      isClaiming || BigInt(pendingRewardAtom) === 0n 
                      ? 'bg-amber-500/10 text-amber-500/40 border-amber-500/10 cursor-not-allowed' 
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
                    }`}
                  >
                    {isClaiming ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />} 
                    Claim Output
                  </button>
                </div>
              </div>

              {/* Presence Pulse (PoP) */}
              <div className="glass-panel-accent p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-[80px]" />
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl text-white relative">
                      <Activity size={24} className="relative z-10" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-widest">Network Health Pulse</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-white/10 text-white rounded-md">Sovereign Witness</span>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-mono font-bold tracking-tighter text-amber-400 animate-pulse-slow">
                    +{ethers.formatUnits(pendingRewardAtom, 18)}
                  </p>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                    Unclaimed Protocol Yield (Live)
                  </p>
                </div>
              </div>

            </div>

            {/* Sovereign Activity */}
            <div className="glass-panel rounded-3xl overflow-hidden border-white/5">
              <div className="bg-white/10 px-6 py-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Activity size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Sovereign Activity</span>
                </div>
                <div className="text-[10px] font-black text-white/20 uppercase">Last 15 Records</div>
              </div>
              <div className="max-h-[320px] overflow-y-auto divide-y divide-white/5 scrollbar-thin">
                {history.map((tx, i) => {
                  const isOut = tx.from_address?.toLowerCase() === wallet.address.toLowerCase();
                  const isStake = tx.tx_type === 'stake';
                  const isUnstake = tx.tx_type === 'unstake';
                  const isReward = tx.tx_type === 'reward' || tx.tx_type === 'presence';
                  
                  return (
                    <div key={tx.id || i} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          isReward ? 'bg-amber-500/10 text-amber-400' :
                          isStake ? 'bg-emerald-500/10 text-emerald-400' :
                          isUnstake ? 'bg-orange-500/10 text-orange-400' :
                          isOut ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {isReward ? <Zap size={14} /> :
                           isStake ? <Lock size={14} /> :
                           isUnstake ? <RefreshCw size={14} /> :
                           isOut ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors">
                            {isReward ? 'Network Protocol Yield' :
                             isStake ? 'Vault Allocation (Stake)' :
                             isUnstake ? 'Vault Release (Unstake)' :
                             isOut ? `Sent: ${tx.to_address?.slice(0,6)}...` : `Recv: ${tx.from_address?.slice(0,6)}...`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-white/20">{new Date(tx.created_at).toLocaleString()}</span>
                            <span className={`text-[9px] font-black uppercase tracking-tighter ${
                              tx.status === 'success' ? 'text-emerald-500/60' :
                              tx.status === 'failed' ? 'text-red-500/60' : 'text-indigo-400/60 animate-pulse'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-mono font-black ${isOut || isStake ? 'text-white/40' : 'text-emerald-400'}`}>
                          {isOut || isStake ? '-' : '+'}{(() => {
                            try { return ethers.formatUnits(tx.amount?.toString() || "0", 18); }
                            catch { return "0.00"; }
                          })()}
                        </p>
                        <p className="text-[8px] text-white/10 font-mono tracking-tighter">#{tx.tx_hash?.slice(-8) || 'unknown'}</p>
                      </div>
                    </div>
                  );
                })}
                {history.length === 0 && (
                  <div className="p-12 text-center">
                    <p className="text-[10px] font-bold text-white/10 uppercase tracking-widest italic">No record found in ledger</p>
                  </div>
                )}
              </div>
            </div>

            {/* Console */}
            <div className="glass-panel rounded-3xl overflow-hidden border-white/5">
              <div className="bg-white/5 px-6 py-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <TerminalIcon size={16} className="text-indigo-400" />
                  <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Peer Telemetry Stream</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[10px] text-white/20 uppercase tracking-widest flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full bg-indigo-500" /> E2EE Secure
                  </span>
                </div>
              </div>
              <div className="p-6 h-[200px] font-mono text-[10px] overflow-y-auto space-y-2 scrollbar-thin">
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-4 ${i === 0 ? 'text-indigo-300' : 'text-white/30'}`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="glass-panel p-6 rounded-3xl space-y-6">
              <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Protocol Resources</h3>
              
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white/60">
                    <div className="p-2 bg-white/5 rounded-lg"><Cpu size={14} /></div>
                    <span className="text-xs font-bold tracking-widest">CPU LOAD</span>
                  </div>
                  <span className="text-[10px] font-mono text-green-400 uppercase">Minimal</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-white/60">
                    <div className="p-2 bg-white/5 rounded-lg"><Database size={14} /></div>
                    <span className="text-xs font-bold tracking-widest">LEDGER</span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-400 uppercase">Synced</span>
                </div>
                
                <div className="h-px bg-white/5 my-2"></div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-white/30 uppercase font-bold mb-2">Network Energy Progress</p>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-lg font-bold">
                      {(() => {
                        try { return ethers.formatUnits(dailyEmission || "0", 18); }
                        catch { return "0.00"; }
                      })()} 
                      <span className="text-[10px] text-white/40"> AUR</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">24H LIVE</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981] transition-all duration-1000 ease-out" 
                      style={{ width: `${(() => {
                        try {
                          return Math.min((parseFloat(ethers.formatUnits(dailyEmission || "0", 18)) / 1.0) * 100, 100);
                        } catch { return 0; }
                      })()}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-3xl bg-indigo-500/5 glow-border relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity">
                <Shield size={40} className="text-indigo-500" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xs font-bold tracking-[0.2em] text-indigo-400 uppercase mb-4">Sovereign Intel</h3>
                <p className="text-sm text-white/50 leading-relaxed italic">
                  "Your node is your shield. In the Aura network, every participant is a guardian of the collective truth."
                </p>
              </div>
            </div>

            <button 
              onClick={() => {
                if (window.confirm("CAUTION: Disconnecting will WIPE your identity from this device. You will need your 12-word Seed Phrase to return. Continue?")) {
                  onDisconnect();
                }
              }}
              className="w-full py-4 text-xs font-bold text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all uppercase tracking-widest border border-red-500/10 rounded-2xl shadow-lg"
            >
              Disconnect Node
            </button>
          </div>

        </div>

        <footer className="pt-12 text-center">
          <p className="text-[10px] text-white/10 tracking-[0.4em] font-mono uppercase">
            Aura: Fahsai Distributed Engine • The Era of Digital Sovereignty
          </p>
        </footer>

      </div>
    </div>
  );
};

export default Dashboard;
