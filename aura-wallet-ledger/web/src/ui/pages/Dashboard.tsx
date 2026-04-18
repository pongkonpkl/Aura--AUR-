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
  const [activeModal, setActiveModal] = useState<'send' | 'receive' | 'seed' | 'stake' | 'cloud' | 'challenge' | 'deposit' | 'withdraw' | null>(null);
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

  // Sovereign Seed Challenge (MFA) States
  const [challengeIndex, setChallengeIndex] = useState<number | null>(null);
  const [challengeInput, setChallengeInput] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [challengeError, setChallengeError] = useState(false);

  // --- 🛍️ Premium Marketplace & Swap States ---
  const [marketTab, setMarketTab] = useState<'p2p' | 'swap'>('p2p');
  const [marketOrders, setMarketOrders] = useState<any[]>([]);
  const [isMarketLoading, setIsMarketLoading] = useState(false);
  const [sellOrderAUR, setSellOrderAUR] = useState("");
  const [sellOrderPrice, setSellOrderPrice] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState<number | null>(null);
  const [swapAmount, setSwapAmount] = useState("");
  const [swapTarget, setSwapTarget] = useState<'NATIVE' | 'BTC' | 'ETH'>('NATIVE');
  const [isSwapping, setIsSwapping] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [activeDepositAsset, setActiveDepositAsset] = useState<'NATIVE' | 'BTC' | 'ETH'>('NATIVE');
  const [isSimulatingDeposit, setIsSimulatingDeposit] = useState(false);
  const [depositStep, setDepositStep] = useState<'idle' | 'waiting' | 'confirming' | 'success'>('idle');
  const [activeWithdrawAsset, setActiveWithdrawAsset] = useState<'NATIVE' | 'BTC' | 'ETH'>('NATIVE');
  const [withdrawStep, setWithdrawStep] = useState<'idle' | 'processing' | 'confirming' | 'success'>('idle');
  const [withdrawAmountInput, setWithdrawAmountInput] = useState("");
  const [withdrawTargetInput, setWithdrawTargetInput] = useState("");
  const [gasFeeEstimate, setGasFeeEstimate] = useState<string>("0.00");
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);
  const [activeBridgeTxId, setActiveBridgeTxId] = useState<string | null>(null);

  // --- 🛰️ Sovereign Bridge Utilities ---
  const getGatewayAddress = (asset: string) => {
    if (asset === 'NATIVE') return wallet.address;
    if (asset === 'BTC') {
      return `bc1q${wallet.address.toLowerCase().slice(2, 22)}aura`;
    }
    if (asset === 'ETH') {
      // Professional Gateway Address (Sovereign Receiver)
      return "0x156cF51F218B97181C8DDAd12e7D9298C1cc63E8";
    }
    return wallet.address;
  };

  // --- 🛰️ Legacy Bridge Deactivated ---

  const handleSimulateWithdraw = async () => {
    if (!withdrawAmountInput || !withdrawTargetInput) return;
    
    const action = async () => {
      setWithdrawStep('processing');
      try {
        const amountAtom = ethers.parseUnits(withdrawAmountInput, 18);
        const currentNonce = await fetchNonce(wallet.address);
        const nextNonce = currentNonce + 1;

        addLog(`Sovereign Protocol: Preparing Egress for ${withdrawAmountInput} AUR...`);
        
        // Cryptographic Egress Message
        const message = `AUR_EGRESS:${nextNonce}:${wallet.address.toLowerCase()}:${withdrawTargetInput.toLowerCase()}:${amountAtom}`;
        const signature = await wallet.signMessage(message);

        addLog("Settlement: Authorized Burn Protocol via Signature.");
        
        const { data, error } = await supabase.rpc('rpc_settle_egress', {
          p_user_address: wallet.address.toLowerCase(),
          p_target_evm_address: withdrawTargetInput.toLowerCase(),
          p_amount_atom: amountAtom.toString(),
          p_signature: signature,
          p_nonce: nextNonce
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        setWithdrawStep('success');
        addLog(`🔥 Burn Finalized: ${withdrawAmountInput} AUR removed from Ledger.`);
        addLog(`📡 Bridge Signal: Egress queued for MetaMask (${withdrawTargetInput.slice(0,6)}...)`);
        
        // Update local state optimistically
        setBalanceAtom((prev) => (BigInt(prev) - amountAtom).toString());
        setWithdrawAmountInput("");
        setWithdrawStep('success'); // Show success green state
        
        setTimeout(() => {
          setWithdrawStep('idle');
          setActiveModal(null);
        }, 4000);

      } catch (e: any) {
        addLog(`❌ Egress Error: ${e.message}`);
        console.error("Egress Failed:", e);
        setWithdrawStep('idle');
      }
    };
    wrapWithChallenge(action);
  };

  const [nativeBalance, setNativeBalance] = useState("0.00");
  const [btcBalance, setBtcBalance] = useState("0.000");
  const [ethBalance, setEthBalance] = useState("0.00");


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

  // ☁️ Production Cloud Service Listener (Real-time Bridge Sync)
  useEffect(() => {
    if (!activeBridgeTxId) return;

    const channel = supabase.channel('bridge-realtime')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'transactions',
        filter: `id=eq.${activeBridgeTxId}`
      }, (payload) => {
          const updatedTx = payload.new;
          if (updatedTx.status === 'success') {
              setWithdrawStep('success');
              addLog(`✅ L1 SETTLEMENT ACHIEVED! Hash: ${updatedTx.tx_hash.slice(0,10)}...`);
              toast.success("Bridge Transfer Successful!");
              setTimeout(() => {
                  setActiveBridgeTxId(null);
                  setWithdrawStep('idle');
                  setWithdrawAmountInput("");
                  setWithdrawTargetInput("");
                  setActiveModal(null);
              }, 3000);
          } else if (updatedTx.status === 'failed') {
              setWithdrawStep('idle');
              setActiveBridgeTxId(null);
              addLog(`❌ L1 SETTLEMENT FAILED: ${updatedTx.error_log}`);
              toast.error("Bridge Transfer Failed. Balance Refunded.");
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeBridgeTxId]);

  // ⛽ Real-time L1 Gas Price Estimator
  useEffect(() => {
    if (activeModal !== 'withdraw' || activeWithdrawAsset !== 'ETH') return;

    const estimateGas = async () => {
        setIsEstimatingGas(true);
        try {
            const provider = new ethers.JsonRpcProvider("https://eth-sepolia.g.alchemy.com/v2/demo");
            const feeData = await provider.getFeeData();
            if (feeData.gasPrice) {
                // Typical L1 Transfer is 21,000 gas
                const estimate = ethers.formatUnits(feeData.gasPrice * 21000n, 18);
                setGasFeeEstimate(parseFloat(estimate).toFixed(6));
            }
        } catch (e) {
            console.error("Gas estimation error:", e);
        }
        setIsEstimatingGas(false);
    };

    estimateGas();
    const interval = setInterval(estimateGas, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [activeModal, activeWithdrawAsset]);

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

  const handleClaim = async () => {
    const action = async () => {
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
    wrapWithChallenge(action);
  };


  const handleWithdraw = async () => {
    if (BigInt(balanceAtom) <= 0n) {
      addLog("❌ Nothing to withdraw from Celestial Treasury.");
      return;
    }
    const action = async () => {
      setIsClaiming(true);
      try {
        addLog(`Pushing Withdrawal Signal to Supabase High-Speed Queue...`);
        
        const currentNonce = await fetchNonce(wallet.address);
        const nextNonce = currentNonce + 1;
        const message = `AUR_WITHDRAW_RPC:${nextNonce}:${wallet.address.toLowerCase()}:${balanceAtom}`;
        const signature = await wallet.signMessage(message);

        // High-Speed RPC Call to Supabase
        const { error } = await supabase.rpc('queue_withdrawal', {
            user_wallet: wallet.address.toLowerCase(),
            amount_val: balanceAtom.toString(), 
            sig: signature
        });

        if (error) throw error;

        // Optimistic UI Update: Make it feel instant
        const withdrawnAmount = ethers.formatUnits(balanceAtom, 18);
        setBalanceAtom("0");
        addLog(`✅ Signal Sent! ${withdrawnAmount} AUR is being bridged to your MetaMask via Cloud Validator.`);
        setLastCloudOpTime(Date.now());
        
      } catch (e: any) {
        addLog(`❌ High-Speed Queue Error: ${e.message}`);
      }
      setIsClaiming(false);
    };
    wrapWithChallenge(action);
  };

  // --- 🛍️ Sovereign Marketplace (Enhanced Engine) ---

  const fetchOrders = async () => {
    setIsMarketLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (data && !error) {
        setMarketOrders(data);
      }
    } catch (e) { /* silent fail */ }
    setIsMarketLoading(false);
  };

  useEffect(() => {
    fetchOrders();
    // Realtime Sync
    const channel = supabase
      .channel('market_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_orders' }, fetchOrders)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- 🛒 P2P Marketplace Logic ---
  

  const handleSettleOrder = async (orderId: number, sellerAddress: string, aurAmount: string, nativeAmount: string) => {
    if (simulationMode) {
      alert("Simulation Mode: Settle P2P processed locally.");
      return;
    }

    if (sellerAddress.toLowerCase() === wallet.address.toLowerCase()) {
      alert("You cannot settle your own order.");
      return;
    }

    const confirmed = window.confirm(`Settle P2P: Pay ${nativeAmount} Native to receive ${ethers.formatUnits(aurAmount, 18)} AUR (after 1% burn)?`);
    if (!confirmed) return;

    await wrapWithChallenge(async () => {
      try {
        // 1. Mark order as inactive in Supabase
        const { error: orderError } = await supabase
          .from('marketplace_orders')
          .update({ is_active: false, buyer: wallet.address.toLowerCase() })
          .eq('id', orderId);

        if (orderError) throw orderError;

        // 2. Create Transaction Record (Atomic Shift)
        const amountBig = BigInt(aurAmount);
        const burnAmount = amountBig / 100n;
        const receiveAmount = amountBig - burnAmount;

        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            from_address: sellerAddress.toLowerCase(),
            to_address: wallet.address.toLowerCase(),
            amount: receiveAmount.toString(),
            tx_type: 'transfer',
            status: 'success',
            tx_hash: `p2p-settle-${Date.now()}`,
            chain_id: 1337,
            burn_penalty: burnAmount.toString()
          });

        if (txError) throw txError;

        alert("P2P Order Settled Successfully!");
        fetchOrders();
      } catch (err: any) {
        console.error("Settlement Error:", err);
        alert("Failed to settle P2P order: " + err.message);
      }
    });
  };

  const handlePlaceSellOrder = async () => {
    if (!sellOrderAUR || !sellOrderPrice) return;
    const action = async () => {
      setIsPlacingOrder(true);
      try {
        const amountAtom = ethers.parseUnits(sellOrderAUR, 18);
        const currentNonce = await fetchNonce(wallet.address);
        const nextNonce = currentNonce + 1;
        
        const message = `AUR_SELL:${nextNonce}:${wallet.address.toLowerCase()}:${amountAtom}:${sellOrderPrice}`;
        const signature = await wallet.signMessage(message);
        
        // Push to Cloud Validator (using existing queue system)
        const txHash = await submitCloudTx('sell_order', { 
          address: wallet.address, 
          amount_atom: amountAtom.toString(), 
          price: sellOrderPrice,
          nonce: nextNonce 
        }, signature);

        // Optimistic UI: Add to Supabase
        await supabase.from('marketplace_orders').insert({
          seller: wallet.address.toLowerCase(),
          aur_requested: amountAtom.toString(),
          native_amount: sellOrderPrice,
          is_active: true
        });

        addLog(`Marketplace Signal Broadcasted. Hash: ${txHash.slice(0,12)}...`);
        setSellOrderAUR("");
        setSellOrderPrice("");
        fetchOrders();
      } catch (e: any) {
        alert(e.message);
      }
      setIsPlacingOrder(false);
    };
    wrapWithChallenge(action);
  };

  const handleSwap = async () => {
    if (!swapAmount || parseFloat(swapAmount) <= 0) return;
    addLog(`Quantum Engine: Initiating authorization check for ${swapAmount} AUR...`);
    const action = async () => {
      setIsSwapping(true);
      try {
        const amountAtom = ethers.parseUnits(swapAmount, 18);
        const currentNonce = await fetchNonce(wallet.address);
        const nextNonce = currentNonce + 1;

        addLog(`Vault Signal: Preparing payload for swap. Nonce: ${nextNonce}`);
        const message = `AUR_SWAP:${nextNonce}:${wallet.address.toLowerCase()}:${amountAtom}:NATIVE`;
        const signature = await wallet.signMessage(message);

        addLog(`Broadcasting to Cloud: Swaping ${swapAmount} AUR -> NATIVE...`);
        
        // 1% Burn Simulation in UI
        const burnAmount = amountAtom / 100n;
        const finalReceived = (parseFloat(swapAmount) * 10.0) * 0.99;

        const result = await submitCloudTx('swap', { 
          address: wallet.address, 
          amount_atom: amountAtom.toString(), 
          target: 'NATIVE',
          nonce: nextNonce 
        }, signature);

        addLog(`🔥 Burn Registered: ${ethers.formatUnits(burnAmount, 18)} AUR incinerated.`);
        addLog(`✅ Swap Settled. Internal IOU Credited: ${finalReceived.toFixed(4)} NATIVE.`);
        setSwapAmount("");
      } catch (e: any) {
        console.error("Swap Logic Error:", e);
        addLog(`❌ Error: ${e.message}`);
        alert(e.message);
      }
      setIsSwapping(false);
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


      {/* Challenge Modal */}
      {activeModal === 'challenge' && (
        <div className="modal-overlay" onClick={() => { setActiveModal(null); setPendingAction(null); }}>
          <div className="modal-content max-w-md border-indigo-500/20 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Shield size={20} />
                  </div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Identity Challenge</h2>
               </div>
               <button onClick={() => { setActiveModal(null); setPendingAction(null); }} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20} className="text-white/20" /></button>
            </div>

            <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 mb-8 text-center space-y-4 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full" />
               <p className="text-sm text-white/60 leading-relaxed font-medium relative z-10">
                 To authorize this cloud operation, please provide word <span className="text-indigo-400 font-black">#{ (challengeIndex || 0) + 1 }</span> from your 12-word Sovereign Seed Phrase.
               </p>
               <div className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.3em]">MFA: Security Level Alpha</div>
            </div>

            <div className="space-y-6">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1">Challenge Input</label>
                  <input 
                    type="password"
                    autoFocus
                    className={`w-full bg-black/50 border ${challengeError ? 'border-red-500/50' : 'border-white/10'} rounded-2xl p-5 text-center text-2xl font-mono font-bold text-white placeholder-white/5 focus:border-indigo-500/50 outline-none transition-all tracking-[0.1em]`}
                    placeholder="ENTER WORD..."
                    value={challengeInput}
                    onChange={(e) => {
                      setChallengeInput(e.target.value);
                      if (challengeError) setChallengeError(false);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyChallenge()}
                  />
                  {challengeError && (
                    <p className="text-[10px] font-bold text-red-500 mt-2 text-center uppercase tracking-tighter animate-in shake duration-300">
                      ❌ Verification Failed: Invalid Mnemonic Match
                    </p>
                  )}
               </div>

               <button 
                 onClick={handleVerifyChallenge}
                 className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/10 active:scale-95"
               >
                 <Key size={18} /> Complete Identity Check
               </button>

               <div className="flex flex-col items-center gap-2 pt-2">
                 <p className="text-[9px] text-white/20 uppercase font-black tracking-[0.3em] flex items-center gap-2">
                   <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> E2EE Sovereign Protection
                 </p>
               </div>
            </div>
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
                  onSetMax={() => setSendAmount(ethers.formatUnits(balanceAtom, 18))}
                />
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

      {/* --- 🏦 Sovereign Deposit & Gateway Modal --- */}
      {activeModal === 'deposit' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content max-w-xl border-indigo-500/20" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Deposit Gateway</h2>
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">External Asset Inflow (Sovereign Bridge)</p>
                </div>
                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20} className="text-white/20" /></button>
             </div>

              <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 mb-8">
                  <div className="flex-1 py-3 bg-indigo-500 text-white rounded-xl font-black text-[10px] uppercase text-center shadow-lg">
                    NATIVE (Sovereign Input)
                  </div>
              </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                   <div className="p-4 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center justify-center aspect-square">
                      <div className="p-4 bg-white rounded-2xl mb-4">
                        <QRCodeSVG value={getGatewayAddress(activeDepositAsset)} size={140} />
                      </div>
                      <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">Scan to Bridge</p>
                   </div>
                </div>

                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">Sovereign Receiver Address</label>
                      <div className="bg-black/40 border border-white/10 rounded-2xl p-4 relative group">
                         <p className="text-[11px] font-mono text-indigo-100 break-all pr-10">{getGatewayAddress(activeDepositAsset)}</p>
                         <button onClick={() => {
                            navigator.clipboard.writeText(getGatewayAddress(activeDepositAsset));
                            toast.success("Gateway Address Copied");
                         }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/20 hover:text-indigo-400 transition-all">
                           <Copy size={16} />
                         </button>
                      </div>
                   </div>

                    <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 text-center">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">Sovereign Protocol Active</p>
                        <p className="text-[10px] text-white/30 leading-relaxed font-medium">
                             This QR code represents your Sovereign Identity on the Aura Distributed Ledger. It is the primary cryptographic endpoint for vault synchronization and network presence within your autonomous infrastructure.
                        </p>
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Bridge System Deactivated */}


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
                <div className="flex gap-4">
                  <button 
                    onClick={() => setActiveModal('send')}
                    className="flex-1 py-4 bg-indigo-500/10 text-indigo-400 font-bold rounded-2xl border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight size={18} /> Send
                  </button>
                  <button 
                    onClick={() => setActiveModal('receive')}
                    className="flex-1 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    <ArrowDownLeft size={18} /> Receive
                  </button>
                </div>
              </div>

               {/* Sovereign Staking (PoS) */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group border border-emerald-500/10">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full" />
                   <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-4">
                       <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                         <Lock size={24} />
                       </div>
                       <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Sovereign Stake</span>
                     </div>
                   </div>
                   <div className="space-y-1 mb-8">
                     <p className="text-4xl font-bold tracking-tighter text-emerald-100 group-hover:text-emerald-400 transition-colors">
                       {ethers.formatUnits(stakedBalanceAtom, 18)}<span className="text-xl text-emerald-400/40"> AUR</span>
                     </p>
                     <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-2">
                       <RefreshCw size={10} className="animate-spin-slow" /> Compounding Active
                     </p>
                   </div>
                   <button 
                     onClick={() => { setStakingTab('stake'); setActiveModal('stake'); }} 
                     className="w-full py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 rounded-xl font-bold border border-emerald-500/20 transition-all text-xs"
                   >
                     Manage Vault
                   </button>
                 </div>

                 {/* LIVE REWARD COUNTER (The Antidote to Boredom) */}
                 <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group border border-amber-500/20 shadow-[0_0_30px_rgba(245,158,11,0.05)]">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
                   <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-4">
                       <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                         <Zap size={24} className="animate-pulse" />
                       </div>
                       <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Reward Accrual</span>
                     </div>
                     <div className="flex flex-col items-center justify-center px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-md border border-amber-500/20 text-[9px] font-black italic leading-[1.1]">
                         <span>AUR</span>
                         <span>PROTOCOL</span>
                      </div>
                   </div>
                   <div className="space-y-1 mb-8">
                     <p className="text-4xl font-bold tracking-tighter text-amber-500 group-hover:scale-105 transition-transform origin-left">
                       {parseFloat(ethers.formatUnits(BigInt(pendingRewardAtom) + optimisticReward, 18)).toFixed(4)}
                       <span className="text-xl opacity-30"> AUR</span>
                     </p>
                     <p className="text-[10px] text-amber-500/60 font-medium tracking-tight">
                       Real-time cloud mining from active presence.
                     </p>
                   </div>
                   <button 
                     disabled={isClaiming || (BigInt(pendingRewardAtom) + optimisticReward) <= 0n}
                     onClick={handleClaim}
                     className={`w-full py-4 bg-amber-500 text-black font-black text-xs uppercase rounded-xl shadow-lg shadow-amber-500/20 hover:bg-amber-400 hover:scale-[1.02] active:scale-95 transition-all relative flex items-center justify-center ${
                       isClaiming || (BigInt(pendingRewardAtom) + optimisticReward) <= 0n ? 'opacity-20 grayscale pointer-events-none' : ''
                     }`}
                   >
                     <div className="absolute left-6">
                        {isClaiming ? <RefreshCw size={14} className="animate-spin" /> : <PlusCircle size={14} />}
                     </div>
                     Claim Sovereign Rewards
                   </button>
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
                  const isOut = tx.from_address?.toLowerCase() === wallet.address.toLowerCase() && tx.tx_type === 'transfer';
                  const isStake = tx.tx_type === 'stake';
                  const isUnstake = tx.tx_type === 'unstake';
                  const isReward = tx.tx_type === 'reward' || tx.tx_type === 'presence';
                  const isBridgeIn = tx.tx_type === 'bridge_in';
                  const isBridgeOut = tx.tx_type === 'bridge_out';
                  
                  return (
                    <div key={tx.id || i} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          isReward ? 'bg-amber-500/10 text-amber-400' :
                          isStake ? 'bg-emerald-500/10 text-emerald-400' :
                          isUnstake ? 'bg-orange-500/10 text-orange-400' :
                          isBridgeIn ? 'bg-green-500/10 text-green-400' :
                          isBridgeOut ? 'bg-pink-600/10 text-pink-500' :
                          isOut ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {isReward ? <Zap size={14} /> :
                           isStake ? <Lock size={14} /> :
                           isUnstake ? <RefreshCw size={14} /> :
                           isBridgeIn ? <ArrowDownLeft size={14} /> :
                           isBridgeOut ? <ArrowUpRight size={14} /> :
                           isOut ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors">
                            {isReward ? 'Network Protocol Yield' :
                             isStake ? 'Vault Allocation (Stake)' :
                             isUnstake ? 'Vault Release (Unstake)' :
                             isBridgeIn ? 'Cross-Chain Inflow (Bridge In)' :
                             isBridgeOut ? 'Sovereign Egress (Bridge Out)' :
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
                        <p className={`text-xs font-mono font-black ${isOut || isStake || isBridgeOut ? 'text-white/40' : 'text-emerald-400'}`}>
                          {isOut || isStake || isBridgeOut ? '-' : '+'}{(() => {
                            try { 
                                // Bridges don't use 1e18 atom scaling because they aren't AUR
                                if (isBridgeIn || isBridgeOut) return Number(tx.amount).toFixed(4);
                                return ethers.formatUnits(tx.amount?.toString() || "0", 18); 
                            }
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


            {/* --- 🛡️ Sovereign Marketplace & Quantum Swap (Enhanced) --- */}
            <div className="glass-panel rounded-[2.5rem] overflow-hidden border-indigo-500/10 shadow-2xl">
              <div className="bg-indigo-500/10 px-8 py-6 flex flex-col md:flex-row items-center justify-between border-b border-white/5 gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl relative">
                    <Globe size={20} className="text-indigo-400" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white/90 uppercase tracking-widest leading-none mb-1">Sovereign Nebula</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Realtime Node Sync</span>
                      {simulationMode && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 animate-pulse">Simulation Active</span>}
                    </div>
                  </div>
                </div>

                <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                  <button 
                    onClick={() => setMarketTab('p2p')}
                    className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${marketTab === 'p2p' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                  >
                    P2P Market
                  </button>
                  <button 
                    onClick={() => setMarketTab('swap')}
                    className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${marketTab === 'swap' ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                  >
                    Quantum Swap
                  </button>
                </div>

                <div className="flex items-center gap-4">
                   <button 
                    onClick={() => setSimulationMode(!simulationMode)}
                    className={`p-2 rounded-lg transition-all border ${simulationMode ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-white/5 border-white/5 text-white/20 hover:text-white/40'}`}
                    title="Toggle Demo Mode"
                   >
                     <Eye size={16} />
                   </button>
                   <button onClick={fetchOrders} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-all">
                     <RefreshCw size={16} className={isMarketLoading ? 'animate-spin' : ''} />
                   </button>
                </div>
              </div>

              <div className="p-8">
                {marketTab === 'p2p' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* Sell Orders List */}
                    <div className="space-y-6">
                      <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                           <Activity size={14} /> Global Ask Liquidity
                        </h4>
                      </div>

                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 scrollbar-thin">
                        {(simulationMode ? [
                          { id: 101, seller: "0xMock...123", aur_requested: "5000000000000000000", native_amount: "50" },
                          { id: 102, seller: "0xPeer...abc", aur_requested: "12000000000000000000", native_amount: "115" },
                          { id: 103, seller: "0xNode...999", aur_requested: "2500000000000000000", native_amount: "24" },
                        ] : marketOrders).length === 0 && (
                          <div className="py-20 text-center border border-dashed border-white/5 rounded-[2rem] bg-indigo-500/5">
                             <Globe size={40} className="mx-auto text-white/5 mb-4" />
                             <p className="text-xs font-bold text-white/20 uppercase tracking-widest">No active requests found</p>
                          </div>
                        )}
                        
                        {(simulationMode ? [
                          { id: 101, seller: "0xMock...123", aur_requested: "5.0", native_amount: "50" },
                          { id: 102, seller: "0xPeer...abc", aur_requested: "12.0", native_amount: "115" },
                          { id: 103, seller: "0xNode...999", aur_requested: "2.5", native_amount: "24" },
                        ] : marketOrders).map((order: any) => (
                          <div key={order.id} className="bg-white/[0.02] border border-white/5 p-6 rounded-[1.5rem] hover:bg-white/[0.04] transition-all group flex items-center justify-between">
                             <div className="space-y-1">
                                <p className="text-lg font-black text-white leading-none">
                                  {simulationMode ? order.aur_requested : ethers.formatUnits(order.aur_requested || "0", 18)} <span className="text-[10px] text-indigo-400 font-bold">AUR</span>
                                </p>
                                <p className="text-[10px] font-mono font-bold text-emerald-400/60">PRICED @ {order.native_amount} NATIVE</p>
                             </div>
                             <div className="flex flex-col items-end gap-1">
                                <button 
                                  onClick={() => handleSettleOrder(order.id, order.seller, order.aur_requested, order.native_amount)}
                                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase hover:bg-indigo-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all disabled:opacity-20"
                                >
                                  Settle P2P
                                </button>
                               <span className="text-[8px] font-mono text-white/10">{order.seller.slice(0, 10)}...</span>
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Place Order Form */}
                    <div className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 blur-[80px] rounded-full" />
                       <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                          <PlusCircle size={14} className="text-indigo-400" /> Create Sell Order
                       </h4>
                       
                       <div className="space-y-6 relative z-10">
                          <div className="space-y-2">
                             <SovereignInput 
                                label="AUR Quantity to Sell"
                                value={sellOrderAUR}
                                onChange={(e: any) => setSellOrderAUR(e.target.value)}
                                asset="AUR"
                                maxAvailable={Number(ethers.formatUnits(balanceAtom, 18)).toFixed(4)}
                                onSetMax={() => setSellOrderAUR(ethers.formatUnits(balanceAtom, 18))}
                                subtext={`1% Burn Protocol Applied to Sellers`}
                             />
                          </div>
                          <div className="space-y-2">
                             <SovereignInput 
                                label="Price (Expected Native)"
                                value={sellOrderPrice}
                                onChange={(e: any) => setSellOrderPrice(e.target.value)}
                                asset="NATIVE"
                                maxAvailable="∞"
                                onSetMax={() => setSellOrderPrice("100.00")}
                                subtext={`You will receive ${sellOrderPrice || "0.00"} NATIVE`}
                             />
                          </div>
                          
                          <button 
                            disabled={isPlacingOrder || !sellOrderAUR || !sellOrderPrice}
                            onClick={handlePlaceSellOrder}
                            className={`w-full py-5 rounded-[1.5rem] font-black text-xs uppercase transition-all active:scale-95 flex items-center justify-center gap-2 ${
                              isPlacingOrder || !sellOrderAUR || !sellOrderPrice ? 'bg-white/5 text-white/20' : 'bg-white text-black hover:bg-neutral-200 shadow-xl'
                            }`}
                          >
                             {isPlacingOrder ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                             {isPlacingOrder ? 'Broadcasting...' : 'Lock AUR & List Order'}
                          </button>
                       </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-2xl mx-auto py-8">
                    <div className="bg-white/[0.02] p-10 rounded-[3rem] border border-white/10 space-y-8 relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-60 h-60 bg-emerald-500/5 blur-[100px] rounded-full" />
                       
                       <div className="space-y-4">
                          <SovereignInput 
                             label="Quantum Input"
                             value={swapAmount}
                             onChange={(e: any) => setSwapAmount(e.target.value)}
                             asset="AUR"
                             maxAvailable={Number(ethers.formatUnits(balanceAtom, 18)).toFixed(4)}
                             onSetMax={() => setSwapAmount(ethers.formatUnits(balanceAtom, 18))}
                             subtext={`Instant AMM Swap Route`}
                          />
                       </div>

                       <div className="flex justify-center -my-4 relative z-10">
                          <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20 border border-white/10 text-white animate-bounce-subtle">
                             <ArrowDownRight size={20} />
                          </div>
                       </div>

                       <div className="space-y-4">
                          <label className="text-xs font-black text-white/30 uppercase tracking-widest">Quantum Output (Estimated)</label>
                          <div className="flex bg-black/40 border border-white/10 rounded-[1.5rem] overflow-hidden">
                             <div className="px-8 py-6 flex-1 text-2xl font-black font-mono text-emerald-400">
                               {(parseFloat(swapAmount || "0") * 10.0 * 0.99).toFixed(2)}
                             </div>
                              <div className="bg-white/5 border-l border-white/10 px-10 flex items-center justify-center font-black text-sm text-white uppercase tracking-widest">
                                NATIVE
                              </div>
                          </div>
                       </div>

                       <div className="p-5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-2">
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                             <span className="text-white/30">Exchange Rate</span>
                             <span className="text-emerald-400">1 AUR = 10 {swapTarget}</span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                             <span className="text-white/30">Protocol Burn (1%)</span>
                             <span className="text-red-400">-{ (parseFloat(swapAmount || "0") * 0.01).toFixed(4) } AUR</span>
                          </div>
                       </div>

                       <button 
                        disabled={isSwapping || !swapAmount || parseFloat(swapAmount) > parseFloat(ethers.formatUnits(balanceAtom, 18))}
                        onClick={handleSwap}
                        className={`w-full py-6 rounded-2xl font-black text-sm uppercase transition-all active:scale-95 shadow-2xl flex items-center justify-center gap-3 ${
                          isSwapping || !swapAmount || parseFloat(swapAmount) > parseFloat(ethers.formatUnits(balanceAtom, 18)) ? 'bg-white/5 text-white/20' : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20'
                        }`}
                       >
                         {isSwapping ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
                         {isSwapping ? 'Executing Swapping...' : 'Authorize Quantum Swap'}
                       </button>
                    </div>
                  </div>
                )}

                <div className="mt-12 p-6 bg-indigo-500/5 rounded-[2rem] border border-indigo-500/10 flex items-center gap-6">
                   <div className="p-3 bg-indigo-500/10 rounded-2xl">
                      <Shield size={20} className="text-indigo-400" />
                   </div>
                   <p className="text-[10px] text-white/40 leading-relaxed italic font-medium">
                     <span className="text-indigo-400 font-black not-italic">SOVEREIGN PROTOCOL:</span> 1% of AUR is automatically incinerated from the initiator to ensure constant deflationary pressure. Transaction settlement is guaranteed by the Fahsai Sovereign Engine's multi-node quorum.
                   </p>
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

        <footer className="pt-12 text-center pb-20">
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
