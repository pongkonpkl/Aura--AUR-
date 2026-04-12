import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Shield, Coins, Power, LogOut, Cpu, Globe, 
  Database, Terminal as TerminalIcon, ArrowUpRight, ArrowDownLeft, 
  X, AlertCircle, CheckCircle2, RefreshCw, Key, Home, Eye, EyeOff,
  Copy, Scan, Camera, Maximize2, Lock
} from 'lucide-react';
import { ethers } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

import { supabase } from '../../lib/supabase';

interface DashboardProps {
  onLogout: () => void;
  wallet: ethers.Wallet;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, wallet }) => {
  const [isEngineReady, setIsEngineReady] = useState(true);
  const [networkStats, setNetworkStats] = useState({ activeNodes: 0, sharedPool: '0.00' });
  const [activeModal, setActiveModal] = useState<'send' | 'receive' | 'seed' | 'stake' | 'cloud' | null>(null);
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
  const [legacyPendingBalance, setLegacyPendingBalance] = useState<string | null>(null);
  const [isSyncingLegacy, setIsSyncingLegacy] = useState(false);
  const [lastCloudOpTime, setLastCloudOpTime] = useState<number>(Date.now());

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
          .eq('wallet_address', wallet.address)
          .single();

        if (pError && pError.code === 'PGRST116') {
          // Profile not found, create one (Auto-registration)
          await supabase.from('profiles').insert({
            wallet_address: wallet.address,
            nickname: 'Aura Sovereign'
          });
          if (!hasLoggedRegistration.current) {
            addLog("Sovereign Identity Registered in Cloud.");
            hasLoggedRegistration.current = true;
          }
        } 

        if (profile) {
          setBalanceAtom(profile.balance?.toString() || "0");
          setStakedBalanceAtom(profile.staked_balance?.toString() || "0");
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
          sharedPool: ethers.formatUnits(sumToday, 18)
        });
        
        // Initial fallbacks from Cloud data, then Ledger fetch...
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
            setDailyEmission("1000000000000000000"); 

            const legacyBalance = BigInt(ledger.balances?.[wallet.address] || "0");
            const cloudBalance = BigInt(profile?.balance || "0");
            
            if (legacyBalance > cloudBalance) {
              if (!hasLoggedDiscovery.current) {
                addLog(`⚠️ Discovery: Legacy balance of ${ethers.formatUnits(legacyBalance, 18)} AUR found in old ledger.`);
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
          .eq('wallet_address', wallet.address)
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

    syncWithSupabase();
    heartbeat();
    
    const syncInterval = setInterval(syncWithSupabase, 10000);
    const heartbeatInterval = setInterval(heartbeat, 60000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(heartbeatInterval);
    };
  }, [wallet]);


  const fetchNonce = async (address: string): Promise<number> => {
    try {
      // Security Hardening: Prioritize Database-driven Nonce
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_nonce')
        .eq('wallet_address', address)
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
  };

  const handleSend = async () => {
    if(!recipient || !sendAmount) return;
    setIsSending(true);
    try {
      const amountAtom = BigInt(Math.floor(parseFloat(sendAmount) * 1e18));
      
      // 🌟 Replay Protection: Fetch Current Nonce
      const currentNonce = await fetchNonce(wallet.address);
      const nextNonce = currentNonce + 1;
      
      const message = `AUR_TX:${nextNonce}:${wallet.address}:${recipient}:${amountAtom}`;
      const signature = await wallet.signMessage(message);
      
      // All transactions now go through Aura Cloud (Supabase/GitHub)
      await submitCloudTx('transfer', { 
          from_address: wallet.address, 
          to_address: recipient, 
          amount_atom: amountAtom.toString(),
          nonce: nextNonce 
      }, signature);
      
      addLog(`Cloud Send Sent (Nonce: ${nextNonce}). Awaiting validation.`);
      setLastCloudOpTime(Date.now());
      // Optimistic Update
      setBalanceAtom((BigInt(balanceAtom) - amountAtom).toString());
      
      setActiveModal(null);
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

      const message = `AUR_STAKE:${nextNonce}:${wallet.address}:${amountAtom.toString()}`;
      const signature = await wallet.signMessage(message);
      
      await submitCloudTx('stake', { address: wallet.address, amount_atom: amountAtom.toString(), nonce: nextNonce }, signature);
      addLog(`Cloud Stake Sent. Awaiting cloud validation.`);
      setLastCloudOpTime(Date.now());
      // Optimistic Update
      setBalanceAtom((BigInt(balanceAtom) - amountAtom).toString());
      setStakedBalanceAtom((BigInt(stakedBalanceAtom) + amountAtom).toString());
      
      setActiveModal(null);
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

      const message = `AUR_UNSTAKE:${nextNonce}:${wallet.address}:${amountAtom.toString()}`;
      const signature = await wallet.signMessage(message);
      
      await submitCloudTx('unstake', { address: wallet.address, amount_atom: amountAtom.toString(), nonce: nextNonce }, signature);
      addLog(`Unstake request broadcasted to Sovereign Fleet.`);
      setLastCloudOpTime(Date.now());
      // Optimistic Update
      setStakedBalanceAtom((BigInt(stakedBalanceAtom) - amountAtom).toString());
      setBalanceAtom((BigInt(balanceAtom) + amountAtom).toString());
      
      setActiveModal(null);
      setStakeAmount("");
    } catch(e: any) {
      alert(e.message);
    }
    setIsStaking(false);
  };

  const handleSyncLegacy = async () => {
    if(!legacyPendingBalance) return;
    setIsSyncingLegacy(true);
    try {
        const res = await fetch(`${REPO_RAW_BASE}/ledger.json?t=${Date.now()}`);
        const ledger = await res.json();
        const fullLegacyLiquid = ledger.balances?.[wallet.address] || "0";
        const fullLegacyStaked = ledger.staked_balances?.[wallet.address] || "0";

        const message = `SYNC_LEGACY:${fullLegacyLiquid}`;
        const signature = await wallet.signMessage(message);

        await submitCloudTx('sync_legacy', { 
            address: wallet.address, 
            amount_atom: fullLegacyLiquid,
            staked_atom: fullLegacyStaked
        }, signature);

        addLog(`Legacy Asset Recovery broadcasted. Syncing ${ethers.formatUnits(BigInt(fullLegacyLiquid) + BigInt(fullLegacyStaked), 18)} AUR...`);
        setLegacyPendingBalance(null);
        setLastCloudOpTime(Date.now());
    } catch (e: any) {
        alert("Recovery Failed: " + e.message);
    }
    setIsSyncingLegacy(false);
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
                  <div className="relative flex-1">
                    <input 
                      value={recipient} 
                      onChange={e=>setRecipient(e.target.value)} 
                      type="text" 
                      placeholder="0x..." 
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:border-indigo-500 outline-none transition-all font-mono text-sm" 
                    />
                  </div>
                  <button 
                    onClick={() => setIsScannerOpen(!isScannerOpen)}
                    className={`p-4 rounded-xl transition-all border ${isScannerOpen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                  >
                    <Scan size={20} />
                  </button>
                </div>
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
                <input value={sendAmount} onChange={e=>setSendAmount(e.target.value)} type="number" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:border-indigo-500 outline-none transition-all font-bold" />
              </div>
              <button disabled={isSending || !sendAmount || !recipient || (parseFloat(sendAmount) * 1e18) > Number(balanceAtom)} onClick={handleSend} className={`w-full py-5 font-bold rounded-2xl transition-all shadow-lg ${isSending || !sendAmount || !recipient || (parseFloat(sendAmount) * 1e18) > Number(balanceAtom) ? 'bg-indigo-600/50 text-white/50 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}>
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
                        <strong className="text-emerald-400 block mb-1">Earn 80% of Daily AUR Protocol Yield</strong>
                        Lock your Aura into the L3 Smart Contract. You can withdraw anytime. Minimum stake is 1 wei.
                     </>
                   ) : (
                     <>
                        <strong className="text-orange-400 block mb-1">Unlock Sovereign Capital</strong>
                        Move your AUR from the L3 Vault back to your Celestial Treasury. There is zero exit fee.
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
                    Max: {ethers.formatUnits(stakingTab === 'stake' ? balanceAtom : stakedBalanceAtom, 18)}
                  </span>
                </label>
                <input 
                  value={stakeAmount} 
                  onChange={e=>setStakeAmount(e.target.value)} 
                  type="text" 
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

      {/* Security (Seed Phrase) Modal */}
      {activeModal === 'seed' && (
        <div className="modal-overlay" onClick={() => { setActiveModal(null); setIsSeedRevealed(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 text-red-400 rounded-xl"><Key size={20}/></div>
                <h2 className="text-xl font-bold">Secret Recovery Phrase</h2>
              </div>
              <button onClick={() => { setActiveModal(null); setIsSeedRevealed(false); }} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
            </div>
            
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl mb-6 flex gap-4">
              <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
              <p className="text-sm text-white/70">
                <strong className="text-red-400 block mb-1">Never share this phrase.</strong>
                Anyone with these 12 words can access your Sovereign Node and steal your tokens. Aura support will never ask for this.
              </p>
            </div>

            <div className="relative group">
              <div className={`grid grid-cols-3 gap-3 transition-all duration-500 ${!isSeedRevealed ? 'blur-md opacity-50 select-none' : ''}`}>
                {MOCK_SEED.map((word, idx) => (
                  <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xs text-white/30 font-mono w-4">{idx + 1}</span>
                    <span className="font-mono text-sm font-bold text-indigo-300">{word}</span>
                  </div>
                ))}
              </div>
              
              {!isSeedRevealed && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <button 
                    onClick={() => setIsSeedRevealed(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl shadow-2xl hover:bg-white/90 transition-all hover:scale-105"
                  >
                    <Eye size={18} /> Click to Reveal Phrase
                  </button>
                </div>
              )}
            </div>
            
            {isSeedRevealed && (
              <div className="mt-6 flex justify-center">
                 <button 
                  onClick={() => setIsSeedRevealed(false)}
                  className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-all"
                >
                  <EyeOff size={16} /> Hide Phrase
                </button>
              </div>
            )}
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
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
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
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-pulse">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter">
                Pulse: {ethers.formatUnits(dailyEmission, 18)} AUR Today
              </span>
            </div>
            
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 shadow-xl gap-1">
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-lg font-bold text-[10px] flex items-center gap-2 border border-indigo-500/20"
              >
                <Home size={14}/> <span className="hidden lg:inline">Home</span>
              </button>
              <button 
                onClick={() => setActiveModal('seed')}
                className="px-4 py-2 hover:bg-white/5 text-white/40 hover:text-white rounded-lg font-bold text-[10px] transition-all flex items-center gap-2"
              >
                <Shield size={14}/> <span className="hidden lg:inline">Security</span>
              </button>
              <button 
                onClick={() => { setLastCloudOpTime(Date.now()); window.location.reload(); }}
                className="px-4 py-2 hover:bg-white/5 text-white/40 hover:text-white rounded-lg font-bold text-[10px] transition-all flex items-center gap-2"
              >
                <RefreshCw size={14} /> <span className="hidden lg:inline">Sync Now</span>
              </button>
            </div>

            {legacyPendingBalance && (
              <button 
                onClick={handleSyncLegacy}
                disabled={isSyncingLegacy}
                className={`px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-[10px] transition-all flex items-center gap-2 border border-emerald-400/30 animate-pulse hover:scale-105 ${isSyncingLegacy ? 'opacity-50' : ''}`}
              >
                <RefreshCw size={14} className={isSyncingLegacy ? 'animate-spin' : ''} /> 
                <span>{isSyncingLegacy ? 'Syncing...' : 'Sync Old Assets'}</span>
              </button>
            )}
            
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
                  <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Global Fleet</span>
                </div>
                <div className="space-y-1">
                  <p className="text-5xl font-bold tracking-tighter text-white group-hover:text-blue-400 transition-colors">
                    {networkStats.activeNodes}
                  </p>
                  <p className="text-sm text-white/30 font-medium whitespace-nowrap">Verified Peer Node Connections</p>
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
                  <span className="text-[10px] font-bold px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/20">L3 Vault</span>
                </div>
                <div className="space-y-1 mb-8">
                  <p className="text-5xl font-bold tracking-tighter text-emerald-100 group-hover:text-emerald-400 transition-colors">
                    {ethers.formatUnits(stakedBalanceAtom, 18)}<span className="text-2xl text-emerald-400/40"> AUR</span>
                  </p>
                  <p className="text-sm text-emerald-400 font-medium flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin-slow" /> Compounding (Validator Reward: 20% Yield)
                  </p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setStakingTab('stake'); setActiveModal('stake'); }} 
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold flex justify-center items-center gap-2 border border-emerald-500 transition-all text-sm shadow-lg shadow-emerald-900/20"
                  >
                    Lock & Earn Output
                  </button>
                </div>
              </div>

              {/* Presence Pulse (PoP) */}
              <div className="glass-panel-accent p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-[80px]" />
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl text-white relative">
                      <div className="pulse-ring" />
                      <Activity size={24} className="relative z-10" />
                    </div>
                    <span className="text-sm font-bold text-white uppercase tracking-widest">Presence Drop</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-white/10 text-white rounded-md">PoP Claim</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-bold">Autonomous Airdrop</p>
                  <p className="text-sm text-indigo-300 font-medium">Autonomous Presence (80% Base Yield)</p>
                </div>
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
              <div className="p-6 h-[320px] font-mono text-xs overflow-y-auto space-y-2 scrollbar-thin">
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
                    <span className="text-lg font-bold">{ethers.formatUnits(dailyEmission, 18)} <span className="text-[10px] text-white/40">AUR</span></span>
                    <span className="text-[10px] text-emerald-400 font-bold">24H LIVE</span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 shadow-[0_0_8px_#10b981]" 
                      style={{ width: `${Math.min((Number(BigInt(dailyEmission) / BigInt(1e14)) / 10000) * 100, 100)}%` }}
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
              onClick={onLogout}
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
