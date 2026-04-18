import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Shield, Coins, Power, LogOut, Cpu, Globe, 
  Database, Terminal as TerminalIcon, ArrowUpRight, ArrowDownLeft, 
  X, AlertCircle, CheckCircle2, RefreshCw, Key, Home, Eye, EyeOff,
  Copy, Scan, Camera, Maximize2, Lock, Zap, PlusCircle, ArrowDownRight, Bitcoin
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

const SovereignInput = ({ label, value, onChange, asset, maxAvailable, onSetMax, subtext }: any) => (
  <div className="space-y-1">
     {label && <label className="text-[10px] font-black text-white/40 uppercase tracking-widest px-1">{label}</label>}
     <div className="relative group">
       <input 
          type="number"
          className="w-full bg-[#1e1e1e] border border-white/10 rounded-xl p-4 text-xl font-mono font-bold text-white placeholder-white/20 focus:border-white/30 hover:border-white/20 outline-none transition-all pr-24"
          placeholder="0.00"
          step="any"
          value={value}
          onChange={onChange}
       />
       <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white flex items-center gap-1">{asset} <span className="text-[10px]">↕</span></span>
     </div>
     <div className="flex justify-between items-center px-1 pt-1">
       <span className="text-[11px] text-white/50 font-medium">{subtext || `$0.00`}</span>
       <div className="text-[11px] flex items-center gap-1.5">
          <span className="text-white/50">{maxAvailable} {asset} available</span>
          <button onClick={onSetMax} className="text-[#3b82f6] hover:text-blue-400 font-bold transition-all p-1">Max</button>
       </div>
     </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ onLogout, onDisconnect, wallet }) => {
  const [isEngineReady, setIsEngineReady] = useState(true);
  const [networkStats, setNetworkStats] = useState({ activeNodes: 0, sharedPool: '0.00' });
  const [activeModal, setActiveModal] = useState<'send' | 'stake' | null>(null);
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
  const [pendingTxs, setPendingTxs] = useState<any[]>([]);
  const pendingTxsRef = useRef<any[]>([]);
  
  // Sync Ref with State for use in Intervals (Prevents Stale Closures)
  useEffect(() => {
    pendingTxsRef.current = pendingTxs;
  }, [pendingTxs]);
  const [history, setHistory] = useState<any[]>([]);
  const [lastCloudOpTime, setLastCloudOpTime] = useState<number>(Date.now());
  const [recipientProfile, setRecipientProfile] = useState<{nick?: string, exists: boolean} | null>(null);
  const [isCheckingRecipient, setIsCheckingRecipient] = useState(false);
  const [pendingRewardAtom, setPendingRewardAtom] = useState<string>("0");
  const [optimisticReward, setOptimisticReward] = useState<bigint>(0n);
  const [isClaiming, setIsClaiming] = useState(false);


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
        // 1. Fetch Global Sovereign Stats (Pre-calculated for 1B Scale)
        const { data: globalStats } = await supabase
          .from('sovereign_stats')
          .select('*')
          .eq('id', 'global')
          .single();

        if (globalStats) {
          setTotalEmission(globalStats.total_supply_atom?.toString() || "0");
          setDailyEmission(globalStats.daily_mined_atom?.toString() || "0");
          setActiveNodesCount(Number(globalStats.total_wallets || 0));
          setNetworkStats({ 
            activeNodes: Number(globalStats.total_wallets || 0), 
            sharedPool: Number(ethers.formatUnits(globalStats.daily_mined_atom || "0", 18)).toFixed(4)
          });
        }

        // 2. Fetch Authoritative Profile & Balance via Singularity Mapper
        const { data: profile, error: pError } = await supabase.rpc('rpc_get_profile', {
          p_user_address: wallet.address.toLowerCase()
        });

        if (pError || !profile) {
          // Auto-registration logic for new sovereign citizens
          await supabase.rpc('rpc_log_pulse', { p_user_address: wallet.address.toLowerCase() });
        } 

        // RPC returns an array for Table-returning functions
        const serverProfile = Array.isArray(profile) ? profile[0] : profile;

        if (serverProfile) {
          let serverBalance = BigInt(serverProfile.balance_atom || "0");
          let serverStaked = BigInt(serverProfile.staked_balance_atom || "0");
          if (serverProfile.pending_reward_atom) setPendingRewardAtom(serverProfile.pending_reward_atom);

          // Apply Optimistic Offsets (Using Ref to prevent Stale Closure/Bouncing)
          const currentPending = pendingTxsRef.current;
          const pendingStake = currentPending.filter(t => t.type === 'stake').reduce((acc, t) => acc + BigInt(t.amount || "0"), 0n);
          const pendingUnstake = currentPending.filter(t => t.type === 'unstake').reduce((acc, t) => acc + BigInt(t.amount || "0"), 0n);
          const pendingOut = currentPending.filter(t => t.type === 'transfer').reduce((acc, t) => acc + BigInt(t.amount || "0"), 0n);

          // Adjusted view for the user (With Safety Lock to prevent Negative Balances)
          const displayBalance = (serverBalance + pendingUnstake) - (pendingStake + pendingOut);
          const displayStaked = (serverStaked + pendingStake) - pendingUnstake;

          const safeBalance = displayBalance < 0n ? 0n : displayBalance;
          const safeStaked = displayStaked < 0n ? 0n : displayStaked;
          
          setBalanceAtom(safeBalance.toString());
          setStakedBalanceAtom(safeStaked.toString());

          // Sync Multi-Vault Assets
          setNativeBalance(serverProfile.native_balance != null ? Number(serverProfile.native_balance).toFixed(2) : "0.00");
          setBtcBalance(serverProfile.btc_balance != null ? Number(serverProfile.btc_balance).toFixed(3) : "0.000");
          setEthBalance(serverProfile.eth_balance != null ? Number(serverProfile.eth_balance).toFixed(6) : "0.000000");
          
          setBalanceAtom(displayBalance.toString());
          setStakedBalanceAtom(displayStaked.toString());
          setIsEngineReady(true);
        }

        // 3. Fetch Sharded Ledger via Audit Bridge (Fixes Empty Ledger Issue)
        const { data: auraLedger, error: lError } = await supabase.rpc('rpc_get_ledger', {
          p_user_address: wallet.address.toLowerCase(),
          p_limit: 15
        });
        
        if (lError) console.error("Ledger Fetch Error:", lError);
        
        if (auraLedger) setHistory(auraLedger);

      } catch (err) {
        console.error("Singularity Sync Error:", err);
      }
    };

    const heartbeat = async () => {
      try {
        const { data, error } = await supabase.rpc('rpc_log_pulse', {
           p_user_address: wallet.address.toLowerCase()
        });

        if (error) throw error;
        setOptimisticReward(0n); // Reset optimistic accumulation after real sync
        addLog(`Sovereign Pulse: Synchronized to Cloud Validator (Reward Accumulated).`);
      } catch (e) {
        addLog("Cloud Pulse failed. Check internet connection.");
      }
    };

    syncWithSupabase();
    heartbeat();
    
    const syncInterval = setInterval(syncWithSupabase, 15000);
    const heartbeatInterval = setInterval(heartbeat, 60000);

    // 📈 Optimistic Reward Counter (Real-time Feedback)
    const optimisticInterval = setInterval(() => {
        // Smoother pulse: increment every 100ms
        // Original: 0.0001 (10^14) per 10s
        // New: 0.000001 (10^12) per 100ms
        setOptimisticReward(prev => prev + 1000000000000n); 
    }, 100);

    return () => {
      clearInterval(syncInterval);
      clearInterval(heartbeatInterval);
      clearInterval(optimisticInterval);
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
        const { data, error } = await supabase.rpc('rpc_check_identity', {
          p_target_address: recipient.toLowerCase()
        });
        
        const profile = Array.isArray(data) ? data[0] : data;

        if (profile && profile.is_valid) {
          setRecipientProfile({ nick: profile.nickname, exists: true });
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
      // Security Hardening: Prioritize Sharded Shard-aware Nonce
      const { data } = await supabase.rpc('rpc_get_profile', {
          p_user_address: address.toLowerCase()
      });
      
      const profile = Array.isArray(data) ? data[0] : data;
      
      if (profile && profile.last_nonce !== undefined) {
        return Number(profile.last_nonce);
      }

      // Fallback: This is legacy logic for transition
      const resp = await fetch(`${LOCAL_ENGINE_URL}/nonce?address=${address}`);
      const fallbackData = await resp.json(); 
      return fallbackData.nonce;
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


  const handleSend = async () => {
    if(!recipient || !sendAmount) return;
    setIsSending(true);
    try {
        const amountAtom = ethers.parseUnits(sendAmount, 18);
        const currentNonce = await fetchNonce(wallet.address);
        const nextNonce = currentNonce + 1;
        
        const message = `AUR_TX:${nextNonce}:${wallet.address.toLowerCase()}:${recipient.toLowerCase()}:${amountAtom.toString()}`;
        const signature = await wallet.signMessage(message);
        
        const txHash = await submitCloudTx('transfer', { 
            from_address: wallet.address.toLowerCase(), 
            to_address: recipient.toLowerCase(), 
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

  const handleStake = async () => {
    if(!stakeAmount) return;
    setIsStaking(true);
    try {
      const amountAtom = ethers.parseUnits(stakeAmount, 18);
      if (amountAtom > BigInt(balanceAtom)) throw new Error("Insufficient Liquid Balance");
      
      const currentNonce = await fetchNonce(wallet.address);
      const nextNonce = currentNonce + 1;

      const message = `AUR_STAKE:${nextNonce}:${wallet.address.toLowerCase()}:${amountAtom.toString()}`;
      const signature = await wallet.signMessage(message);
      
      const txHash = await submitCloudTx('stake', { 
          address: wallet.address.toLowerCase(), 
          amount_atom: amountAtom.toString(), 
          nonce: nextNonce 
      }, signature);
      
      addLog(`Cloud Stake Sent. Awaiting Sovereign Fleet validation.`);
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
  
  const handleUnstake = async () => {
    if(!stakeAmount) return;
    setIsStaking(true);
    try {
      const amountAtom = ethers.parseUnits(stakeAmount, 18);
      if (amountAtom > BigInt(stakedBalanceAtom)) throw new Error("Insufficient Staked Balance");
      
      const currentNonce = await fetchNonce(wallet.address);
      const nextNonce = currentNonce + 1;

      const message = `AUR_UNSTAKE:${nextNonce}:${wallet.address.toLowerCase()}:${amountAtom.toString()}`;
      const signature = await wallet.signMessage(message);
      
      const txHash = await submitCloudTx('unstake', { 
          address: wallet.address.toLowerCase(), 
          amount_atom: amountAtom.toString(), 
          nonce: nextNonce 
      }, signature);
      
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


  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      const currentNonce = await fetchNonce(wallet.address);
      const nextNonce = currentNonce + 1;

      const message = `AUR_CLAIM:${nextNonce}:${wallet.address.toLowerCase()}`;
      const signature = await wallet.signMessage(message);
      
       const { data, error } = await supabase.rpc('rpc_claim_rewards', {
          p_user_address: wallet.address.toLowerCase(),
          p_signature: signature,
          p_nonce: nextNonce
       });
       
       if (error) throw error;
       if (!data.success) throw new Error(data.error);

       addLog(`✅ Reward Claimed: ${ethers.formatUnits(data.claimed_amount, 18)} AUR`);
       setPendingRewardAtom("0");
       setOptimisticReward(0n);
       setBalanceAtom((BigInt(balanceAtom) + BigInt(data.claimed_amount)).toString());
       setLastCloudOpTime(Date.now());
    } catch(e: any) {
      addLog(`❌ Claim Error: ${e.message}`);
    }
    setIsClaiming(false);
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
                <SovereignInput 
                  label="Amount to Transfer"
                  value={sendAmount}
                  onChange={(e: any) => setSendAmount(e.target.value)}
                  asset="AUR"
                  maxAvailable={Number(ethers.formatUnits(balanceAtom, 18)).toFixed(4)}
                  onSetMax={() => {
                        const total = parseFloat(ethers.formatUnits(balanceAtom, 18));
                        const smartMax = total / 1.01;
                        setSendAmount(smartMax.toFixed(6));
                  }}
                />
                <div className="mt-4 p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-2 animate-in fade-in slide-in-from-top-2">
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/40">
                      <span>Network Fee (1%)</span>
                      <span className="text-red-400/80">{(parseFloat(sendAmount || "0") * 0.01).toFixed(6)} AUR</span>
                   </div>
                   <div className="flex justify-between items-center text-sm font-black uppercase tracking-tight">
                      <span className="text-white/60">Total Receive</span>
                      <span className="text-emerald-400">{(parseFloat(sendAmount || "0") * 0.99).toFixed(6)} AUR</span>
                   </div>
                </div>
              </div>
              <button disabled={isSending || !sendAmount || !isValidAddress || (parseFloat(sendAmount) * 1e18) > Number(balanceAtom)} onClick={handleSend} className={`w-full py-5 font-bold rounded-2xl transition-all shadow-lg ${isSending || !sendAmount || !isValidAddress || (parseFloat(sendAmount) * 1e18) > Number(balanceAtom) ? 'bg-indigo-600/50 text-white/50 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
                {isSending ? 'Signing & Sending...' : 'Initiate Sovereign Transfer'}
              </button>
            </div>
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
                <SovereignInput 
                  label={stakingTab === 'stake' ? "Amount to Lock" : "Amount to Unlock"}
                  value={stakeAmount}
                  onChange={(e: any) => setStakeAmount(e.target.value)}
                  asset="AUR"
                  maxAvailable={Number(ethers.formatUnits(stakingTab === 'stake' ? balanceAtom : stakedBalanceAtom, 18)).toFixed(4)}
                  onSetMax={() => {
                        const rawAtom = stakingTab === 'stake' ? balanceAtom : stakedBalanceAtom;
                        setStakeAmount(ethers.formatUnits(rawAtom, 18));
                  }}
                  subtext={stakingTab === 'stake' ? "Lock and yield rewards" : "Wait 3 days unbonding period"}
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
                {isStaking ? (stakingTab === 'stake' ? 'Locking on Sovereign...' : 'Unlocking...') : (stakingTab === 'stake' ? 'Confirm Sovereign Stake' : 'Confirm Unlock')}
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


            
            <div className="flex gap-4">
              <button 
                onClick={onLogout}
                className="px-4 py-2 bg-red-500/5 text-red-400/80 hover:bg-red-500/10 rounded-xl font-bold text-[10px] transition-all flex items-center gap-2 border border-red-500/10 uppercase tracking-widest"
              >
                <LogOut size={14}/> <span className="hidden lg:inline">Lock Wallet</span>
              </button>
            </div>
        {/* Hero Pillars (Header Row) */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8">
          {/* Celestial Treasury - 100% Core Focus */}
          <div className="lg:col-span-10 glass-panel p-8 rounded-3xl relative overflow-hidden group border border-indigo-500/10">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 blur-3xl rounded-full" />
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                <Coins size={24} />
              </div>
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Celestial Treasury</span>
            </div>
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-1">
                <p className="text-6xl font-black tracking-tighter text-white leading-none">
                  {ethers.formatUnits(balanceAtom, 18).slice(0, 6)}<span className="text-xl opacity-20"> AUR</span>
                </p>
                <p className="text-[11px] text-purple-400/60 font-bold uppercase tracking-widest">Liquid Balance (Available to Spend)</p>
              </div>
              
              <div className="flex gap-3 shrink-0">
                <button onClick={() => setActiveModal('send')} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[11px] font-black uppercase transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center gap-2">
                   <ArrowUpRight size={14} /> Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Operations Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-10 gap-6 mb-12">
           {/* Sovereign Stake */}
           <div className="lg:col-span-2 glass-panel p-6 rounded-3xl relative overflow-hidden group border border-emerald-500/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                <Lock size={20} />
              </div>
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Sovereign Stake</span>
            </div>
            <div className="space-y-0.5 mb-6">
              <p className="text-3xl font-bold tracking-tighter text-emerald-100 leading-none">
                {ethers.formatUnits(stakedBalanceAtom, 18).slice(0, 4)}<span className="text-xs opacity-20"> AUR</span>
              </p>
              <div className="text-[9px] font-black text-emerald-400/40 flex items-center gap-1.5 uppercase tracking-widest mt-1">
                 Compounding Active
              </div>
            </div>
            <button onClick={() => { setStakingTab('stake'); setActiveModal('stake'); }} className="w-full py-3 bg-[#111] hover:bg-[#1a1a1a] text-emerald-400 rounded-xl font-black text-[9px] uppercase border border-white/5 transition-all">Manage Vault</button>
          </div>

          {/* Reward Accrual */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-3xl relative overflow-hidden group border border-amber-500/20">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-3xl rounded-full" />
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                <Zap size={20} className="animate-pulse" />
              </div>
              <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Reward Accrual</span>
              <span className="text-[8px] px-1.5 py-0.5 bg-amber-500 text-black font-black rounded uppercase">AUR Protocol</span>
            </div>
            <div className="space-y-0.5 mb-4">
              <p className="text-3xl font-bold tracking-tighter text-amber-500 leading-none">
                {parseFloat(ethers.formatUnits(BigInt(pendingRewardAtom) + optimisticReward, 18)).toFixed(4)}<span className="text-xs opacity-40"> AUR</span>
              </p>
              <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-1">Live cloud mining from presence</p>
            </div>
            <button 
              disabled={isClaiming || (BigInt(pendingRewardAtom) + optimisticReward) <= 0n}
              onClick={handleClaim}
              className="w-full py-3 bg-amber-500 text-black font-black text-[9px] uppercase rounded-xl hover:bg-amber-400 transition-all disabled:opacity-20"
            >
              Claim Sovereign Rewards
            </button>
          </div>

          {/* Peer Telemetry Stream - Moved here for Balance (60% width) */}
          <div className="lg:col-span-6 glass-panel rounded-3xl overflow-hidden border-white/5 flex flex-col">
            <div className="bg-white/5 px-6 py-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <TerminalIcon size={16} className="text-indigo-400" />
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Peer Telemetry Stream</span>
              </div>
              <div className="text-[10px] text-white/20 uppercase tracking-widest flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-indigo-500" /> E2E SECURE
              </div>
            </div>
            <div className="p-6 h-[180px] font-mono text-[9px] overflow-y-auto space-y-2 scrollbar-thin grow">
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-4 ${i === 0 ? 'text-indigo-300 font-bold' : 'text-white/20'}`}>
                   <span className="opacity-10 select-none">❯</span> {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Global Activity Grid */}
        <div className="grid grid-cols-1 gap-8">
          {/* Sovereign Activity */}
          <div className="glass-panel rounded-3xl overflow-hidden border-white/5 flex flex-col">
            <div className="bg-white/10 px-6 py-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <Activity size={16} className="text-emerald-400" />
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Sovereign Activity</span>
              </div>
              <div className="text-[10px] font-black text-white/20 uppercase tracking-widest">Last 15 Records</div>
            </div>
            <div className="max-h-[480px] overflow-y-auto divide-y divide-white/5 scrollbar-thin grow">
              {history.map((tx, i) => {
                const isOut = tx.from_address?.toLowerCase() === wallet.address.toLowerCase() && tx.tx_type === 'transfer';
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
                        <p className="text-[11px] font-bold text-white/80">
                          {isReward ? 'Protocol Yield' :
                           isStake ? 'Vault Allocation' :
                           isUnstake ? 'Vault Release' :
                           isOut ? `Sent: ${tx.to_address?.slice(0,6)}...` : `Recv: ${tx.from_address?.slice(0,6)}...`}
                        </p>
                        <div className="text-[9px] text-white/20">{new Date(tx.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-mono font-black ${isOut || isStake ? 'text-white/40' : 'text-emerald-400'}`}>
                        {isOut || isStake ? '-' : '+'}{(() => {
                          try { 
                              return Number(ethers.formatUnits(tx.amount?.toString() || "0", 18)).toFixed(2); 
                          }
                          catch { return "0.00"; }
                        })()}
                      </p>
                    </div>
                  </div>
                );
              })}
              {history.length === 0 && (
                <div className="p-12 text-center text-[10px] text-white/10 uppercase font-black italic">No records found</div>
              )}
            </div>
          </div>

          {/* Console */}
          <div className="glass-panel rounded-3xl overflow-hidden border-white/5 flex flex-col">
            <div className="bg-white/5 px-6 py-4 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <TerminalIcon size={16} className="text-indigo-400" />
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Peer Telemetry Stream</span>
              </div>
              <div className="text-[10px] text-white/20 uppercase tracking-widest flex items-center gap-1">
                <div className="w-1 h-1 rounded-full bg-indigo-500" /> E2E SECURE
              </div>
            </div>
            <div className="p-6 h-[360px] font-mono text-[10px] overflow-y-auto space-y-2 scrollbar-thin grow">
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-4 ${i === 0 ? 'text-indigo-300 font-bold' : 'text-white/20'}`}>
                   <span className="opacity-20 select-none">❯</span> {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="pt-12 text-center pb-20">
          <div className="mb-8">
             <button 
                onClick={() => {
                  if (window.confirm("CAUTION: Disconnecting will WIPE your identity from this device. Continue?")) {
                    onDisconnect();
                  }
                }}
                className="px-8 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-2xl font-bold text-xs transition-all border border-red-500/10 uppercase tracking-widest"
              >
                Disconnect Node
              </button>
          </div>
          <div className="mb-4 inline-flex items-center gap-2 px-6 py-2 bg-indigo-500/5 border border-indigo-500/10 rounded-full">
            <Shield size={12} className="text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Aura Sovereign Infrastructure • Autonomous Ledger Protocol</span>
          </div>
          <p className="text-[10px] text-white/10 tracking-[0.4em] font-mono uppercase">
            Aura: Fahsai Distributed Engine • The Era of Digital Sovereignty
          </p>
        </footer>

      </div>
    </div>
  );
};

export default Dashboard;
