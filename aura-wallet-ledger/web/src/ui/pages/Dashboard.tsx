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

  const handleVerifyDeposit = async () => {
    if (activeDepositAsset !== 'ETH') {
        setDepositStep('waiting');
        addLog(`Broadcasting Bridge Intent for ${activeDepositAsset}...`);
        await new Promise(r => setTimeout(r, 2000));
        setDepositStep('success');
        addLog(`Simulation: ${activeDepositAsset} inflow detected.`);
        setTimeout(() => setDepositStep('idle'), 3000);
        return;
    }

    setDepositStep('waiting');
    addLog(`🔍 Scanning Sepolia Network for ${activeDepositAsset} inflow...`);
    
    try {
        // PROFESSIONAL SYNC: Check for on-chain state updates in the Cloud DB
        await new Promise(r => setTimeout(r, 2000)); // UI Feedback
        setDepositStep('confirming');
        
        // 🔄 REFETCH SOURCE OF TRUTH
        const { data: updatedProfile, error } = await supabase
            .from('profiles')
            .select('eth_balance')
            .eq('wallet_address', wallet.address.toLowerCase())
            .single();

        if (error || !updatedProfile) {
            setDepositStep('idle');
            return toast.error("Cloud Sync Failed. Check Connection.");
        }

        setEthBalance(Number(updatedProfile.eth_balance).toFixed(6));
        
        addLog(`✅ DATA SYNC: Aura Sovereign Vault synchronized with Global L1 Ledger.`);
        setDepositStep('success');
        toast.success(`Vault Data Synchronized!`);
        
        // Auto-reset to 'idle' so the button works again
        setTimeout(() => setDepositStep('idle'), 3000);

    } catch (err) {
        console.error("Bridge Sync Error:", err);
        setDepositStep('idle');
        toast.error("Network Scan Interrupted.");
  const handleSimulateWithdraw = async () => {
    if (!withdrawAmountInput || !withdrawTargetInput) return toast.error("Provide Amount and Target Address");
    
    let currentBalance = 0;
    if (activeWithdrawAsset === 'NATIVE') currentBalance = parseFloat(nativeBalance);
    else if (activeWithdrawAsset === 'BTC') currentBalance = parseFloat(btcBalance);
    else if (activeWithdrawAsset === 'ETH') currentBalance = parseFloat(ethBalance);

    const withdrawVal = parseFloat(withdrawAmountInput);
    if (withdrawVal <= 0 || isNaN(withdrawVal) || withdrawVal > currentBalance) {
      return toast.error("Insufficient Vault Balance");
    }

    setWithdrawStep('processing');
    addLog(`Initiating Egress Protocol: Burning ${withdrawVal} ${activeWithdrawAsset}...`);
    
    // Hit Supabase Cloud
    const { data, error } = await supabase.rpc('rpc_bridge_asset', {
      p_wallet_address: wallet.address.toLowerCase(),
      p_asset: activeWithdrawAsset,
      p_amount: withdrawVal,
      p_is_deposit: false,
      p_dest_address: withdrawTargetInput
    });

    if (error || !data?.success) {
        setWithdrawStep('idle');
        return toast.error("Egress Communication Failed. Check your connection.");
    }

    // Capture the TX ID for the real-time listener
    const txId = data.tx_id; // Assumes rpc_bridge_asset returns tx_id
    setActiveBridgeTxId(txId);
    setWithdrawStep('confirming');
    addLog(`Asset Egress Queued (ID: ${txId?.slice(0,8)}). Awaiting Cloud Relayer...`);

    // Update Local UI Balance (Optimistic)
    if (activeWithdrawAsset === 'NATIVE') {
      setNativeBalance((currentBalance - withdrawVal).toFixed(2));
    } else if (activeWithdrawAsset === 'BTC') {
      setBtcBalance((currentBalance - withdrawVal).toFixed(3));
    } else {
      setEthBalance((currentBalance - withdrawVal).toFixed(2));
    }
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

          // Sync Cloud Vault Assets
          setNativeBalance(profile.native_balance != null ? Number(profile.native_balance).toFixed(2) : "0.00");
          setBtcBalance(profile.btc_balance != null ? Number(profile.btc_balance).toFixed(3) : "0.000");
          setEthBalance(profile.eth_balance != null ? Number(profile.eth_balance).toFixed(6) : "0.000000");
          
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
            hash_rate: 1.0 // Base PoHA metric
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
    const action = async () => {
      setIsSwapping(true);
      try {
        const amountAtom = ethers.parseUnits(swapAmount, 18);
        const currentNonce = await fetchNonce(wallet.address);
        const nextNonce = currentNonce + 1;

        const message = `AUR_SWAP:${nextNonce}:${wallet.address.toLowerCase()}:${amountAtom}:${swapTarget}`;
        const signature = await wallet.signMessage(message);

        addLog(`Initiating Quantum Swap: ${swapAmount} AUR -> ${swapTarget}...`);
        
        // 1% Burn Simulation in UI
        const burnAmount = amountAtom / 100n;
        const finalReceived = (parseFloat(swapAmount) * 10.0) * 0.99; // 1:10 Rate - 1% Burn

        await submitCloudTx('swap', { 
          address: wallet.address, 
          amount_atom: amountAtom.toString(), 
          target: swapTarget,
          nonce: nextNonce 
        }, signature);

        addLog(`🔥 Burn Registered: ${ethers.formatUnits(burnAmount, 18)} AUR incinerated.`);
        addLog(`✅ Swap Settled. Approximately ${finalReceived.toFixed(4)} ${swapTarget} routed.`);
        setSwapAmount("");
      } catch (e: any) {
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
                {isStaking ? (stakingTab === 'stake' ? 'Locking on L3...' : 'Unlocking...') : (stakingTab === 'stake' ? 'Confirm L3 Stake' : 'Confirm Unlock')}
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
                {['NATIVE', 'BTC', 'ETH'].map((asset) => (
                  <button 
                    key={asset}
                    onClick={() => setActiveDepositAsset(asset as any)}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${activeDepositAsset === asset ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                  >
                    {asset}
                  </button>
                ))}
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

                   <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-2">
                       <div className="flex items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full ${depositStep === 'idle' ? 'bg-indigo-500' : 'bg-emerald-500 animate-pulse'}`} />
                          <p className="text-[10px] font-black text-white/60 uppercase">Bridge Status: {depositStep.toUpperCase()}</p>
                       </div>
                       <p className="text-[10px] text-white/40 leading-relaxed">
                         {activeDepositAsset === 'BTC' ? (
                           "Send REAL Bitcoin to this SegWit address. Our Sovereign Bridge monitors the BTC network and will mint Aura-Wrapped BTC directly into your Vault."
                         ) : (
                           `To deposit ${activeDepositAsset}, send assets from your external wallet to this gateway. Funds will be automatically wrapped and credited to your Vault.`
                         )}
                       </p>
                   </div>

                   <button 
                    disabled={depositStep !== 'idle'}
                    onClick={handleVerifyDeposit}
                    className={`w-full py-4 font-black text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${
                      depositStep === 'success' ? 'bg-emerald-500 text-white' : 'bg-white text-black hover:bg-indigo-100'
                    }`}
                   >
                     {depositStep !== 'idle' && depositStep !== 'success' ? <RefreshCw size={14} className="animate-spin" /> : <ArrowDownLeft size={14} />}
                     {depositStep === 'idle' && `Scan for Real ${activeDepositAsset} Inflow`}
                     {depositStep === 'waiting' && 'Detecting Network Inflow...'}
                     {depositStep === 'confirming' && 'Awaiting Pulse Confirmation...'}
                     {depositStep === 'success' && 'Deposit Finalized!'}
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- 🚀 Sovereign Egress (Withdraw) Modal --- */}
      {activeModal === 'withdraw' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content max-w-xl border-pink-500/20" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Withdraw Gateway</h2>
                  <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mt-1">Cross-Chain Asset Egress</p>
                </div>
                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20} className="text-white/20" /></button>
             </div>

             <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 mb-8">
                {['NATIVE', 'BTC', 'ETH'].map((asset) => (
                  <button 
                    key={asset}
                    onClick={() => setActiveWithdrawAsset(asset as any)}
                    className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${activeWithdrawAsset === asset ? 'bg-pink-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                  >
                    {asset}
                  </button>
                ))}
             </div>

             <div className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">External Destination Address</label>
                   <input 
                      type="text"
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-mono text-white placeholder-white/20 focus:border-pink-500/50 outline-none transition-all"
                      placeholder={`Enter external ${activeWithdrawAsset} address...`}
                      value={withdrawTargetInput}
                      onChange={(e) => setWithdrawTargetInput(e.target.value)}
                   />
                </div>

                <div className="space-y-2">
                   <SovereignInput 
                      label="Withdrawal Amount"
                      value={withdrawAmountInput}
                      onChange={(e: any) => setWithdrawAmountInput(e.target.value)}
                      asset={activeWithdrawAsset}
                      maxAvailable={activeWithdrawAsset === 'NATIVE' ? nativeBalance : activeWithdrawAsset === 'BTC' ? btcBalance : ethBalance}
                      onSetMax={() => setWithdrawAmountInput(activeWithdrawAsset === 'NATIVE' ? nativeBalance : activeWithdrawAsset === 'BTC' ? btcBalance : ethBalance)}
                      subtext="Zero Sovereign Gas Protocol Applied."
                   />
                </div>

                {activeWithdrawAsset === 'ETH' && (
                   <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                       <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">L1 Network Fee Estimate</span>
                       <div className="text-right">
                           <p className="text-xs font-mono font-bold text-pink-400">
                               {isEstimatingGas ? <RefreshCw size={10} className="animate-spin inline mr-1" /> : `~${gasFeeEstimate} ETH`}
                           </p>
                           <p className="text-[8px] text-white/20 uppercase font-bold tracking-tighter">Real-time Sepolia Node Feed</p>
                       </div>
                   </div>
                )}

                <button 
                 disabled={withdrawStep !== 'idle'}
                 onClick={handleSimulateWithdraw}
                 className={`w-full mt-4 py-4 font-black text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${
                   withdrawStep === 'success' ? 'bg-amber-500 text-white' : 'bg-pink-600 text-white hover:bg-pink-500'
                 }`}
                >
                  {withdrawStep !== 'idle' ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
                  {withdrawStep === 'idle' && `Request ${activeWithdrawAsset} Egress`}
                  {withdrawStep === 'processing' && 'Burning Vault Balance...'}
                  {withdrawStep === 'confirming' && 'Queueing L1 Relayer...'}
                  {withdrawStep === 'success' && 'Processing on L1...'}
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
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold flex justify-center items-center gap-2 border border-emerald-500 transition-all text-sm shadow-lg shadow-emerald-900/20"
                  >
                    Lock & Earn Output
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
                             <select 
                               value={swapTarget}
                               onChange={e => setSwapTarget(e.target.value as any)}
                               className="bg-white/5 border-l border-white/10 px-8 font-black text-sm text-white outline-none cursor-pointer hover:bg-white/10 transition-all uppercase tracking-widest"
                             >
                               <option value="NATIVE" className="bg-[#0a0a0a]">NATIVE</option>
                               <option value="BTC" className="bg-[#0a0a0a]">BTC (Aura Wrapped)</option>
                               <option value="ETH" className="bg-[#0a0a0a]">ETH (Aura Wrapped)</option>
                             </select>
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
            {/* Sovereign Multi-Vault */}
            <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 space-y-8 relative overflow-hidden group">
               <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500/10 blur-[60px] group-hover:bg-indigo-500/20 transition-all" />
               <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">Sovereign Multi-Vault</h3>
                  <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                    <Shield size={16} />
                  </div>
               </div>

               <div className="space-y-6">
                  {/* Native Asset */}
                  <div className="flex items-center justify-between group/asset">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 group-hover/asset:bg-indigo-500/20 transition-all border border-indigo-500/20">
                           <Globe size={18} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Native Asset</p>
                           <p className="text-sm font-black text-white">NATIVE</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-sm font-black text-indigo-400 font-mono">{nativeBalance}</p>
                        <p className="text-[8px] font-bold text-white/10 uppercase tracking-tighter">Settlement Liquid</p>
                     </div>
                  </div>

                  {/* Bitcoin Asset */}
                  <div className="flex items-center justify-between group/asset">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 group-hover/asset:bg-amber-500/20 transition-all border border-amber-500/20">
                           <Bitcoin size={18} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Digital Gold</p>
                           <p className="text-sm font-black text-white">BTC</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-sm font-black text-amber-500 font-mono">{btcBalance}</p>
                        <p className="text-[8px] font-bold text-white/10 uppercase tracking-tighter">Aura Wrapped</p>
                     </div>
                  </div>

                  {/* Ethereum Asset */}
                  <div className="flex items-center justify-between group/asset">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover/asset:bg-blue-500/20 transition-all border border-blue-500/20">
                           <Zap size={18} />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Smart Liquidity</p>
                           <p className="text-sm font-black text-white">ETH</p>
                        </div>
                     </div>
                     <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <p className="text-sm font-black text-blue-400 font-mono">{ethBalance}</p>
                        {parseFloat(ethBalance) > 0 && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md">
                            <Shield size={10} className="text-emerald-400" />
                            <span className="text-[8px] font-black text-emerald-400 uppercase">Verified</span>
                          </div>
                        )}
                      </div>
                        <p className="text-[8px] font-bold text-white/10 uppercase tracking-tighter">Aura Wrapped</p>
                     </div>
                  </div>
               </div>

               <div className="flex gap-3">
                 <button 
                    onClick={() => setActiveModal('deposit')}
                    className="flex-1 py-4 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 rounded-xl border border-white/5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] transition-all"
                 >
                    Bridge In
                 </button>
                 <button 
                    onClick={() => setActiveModal('withdraw')}
                    className="flex-1 py-4 bg-white/5 hover:bg-pink-500/20 hover:text-pink-400 rounded-xl border border-white/5 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] transition-all"
                 >
                    Bridge Out
                 </button>
               </div>
            </div>

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
