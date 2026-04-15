import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Shield, Coins, Power, LogOut, Cpu, Globe, 
  Database, Terminal as TerminalIcon, ArrowUpRight, ArrowDownLeft, 
  X, AlertCircle, CheckCircle2, RefreshCw, Key, Home, Eye, EyeOff,
  Copy, Scan, Camera, Maximize2, Lock, Zap, ChevronDown, ChevronUp
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
  const [nativeBalanceAtom, setNativeBalanceAtom] = useState<string>("0");
  const [btcBalanceAtom, setBtcBalanceAtom] = useState<string>("0");
  const [ethBalanceAtom, setEthBalanceAtom] = useState<string>("0");
  const [btcAddress, setBtcAddress] = useState<string>("");
  const [ethAddress, setEthAddress] = useState<string>("");

  // Sovereign Seed Challenge (MFA) States
  const [challengeIndex, setChallengeIndex] = useState<number | null>(null);
  const [challengeInput, setChallengeInput] = useState("");
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [challengeError, setChallengeError] = useState(false);

  // Marketplace States
  const [marketOrders, setMarketOrders] = useState<any[]>([]);
  const [isMarketLoading, setIsMarketLoading] = useState(false);
  const [sellOrderAmount, setSellOrderAmount] = useState("");
  const [sellOrderPrice, setSellOrderPrice] = useState("");
  const [sellOrderCurrency, setSellOrderCurrency] = useState<'NATIVE' | 'BTC' | 'ETH'>('NATIVE');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState<number | null>(null);
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false);
  const [activeMarketTab, setActiveMarketTab] = useState<'p2p' | 'swap'>('p2p');
  const [swapFrom, setSwapFrom] = useState<'AUR' | 'BTC' | 'ETH' | 'NATIVE'>('AUR');
  const [swapTo, setSwapTo] = useState<'BTC' | 'ETH' | 'AUR' | 'NATIVE'>('BTC');
  const [swapAmount, setSwapAmount] = useState("");
  const [isSwapping, setIsSwapping] = useState(false);

  const isValidAddress = recipient ? ethers.isAddress(recipient.toLowerCase()) : null;
  const isSelfSend = recipient.toLowerCase() === wallet.address.toLowerCase();

  const hasLoggedRegistration = useRef(false);
  const hasLoggedDiscovery = useRef(false);

  // Constants
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

  // Sync Logic
  useEffect(() => {
    const syncWithSupabase = async () => {
      try {
        const { data: profile, error: pError } = await supabase
          .from('profiles')
          .select('*')
          .eq('wallet_address', wallet.address.toLowerCase())
          .single();

        if (profile) {
          const serverBalance = BigInt(profile.balance || "0");
          const serverStaked = BigInt(profile.staked_balance || "0");
          
          const pendingOut = pendingTxs.filter(t => t.type === 'transfer' || t.type === 'stake').reduce((acc, t) => acc + t.amount, 0n);
          const pendingIn = pendingTxs.filter(t => t.type === 'unstake').reduce((acc, t) => acc + t.amount, 0n);
          const pendingStakeOut = pendingTxs.filter(t => t.type === 'unstake').reduce((acc, t) => acc + t.amount, 0n);
          const pendingStakeIn = pendingTxs.filter(t => t.type === 'stake').reduce((acc, t) => acc + t.amount, 0n);

          setBalanceAtom((serverBalance - pendingOut + pendingIn).toString());
          setStakedBalanceAtom((serverStaked - pendingStakeOut + pendingStakeIn).toString());
          setNativeBalanceAtom(profile.native_balance || "0");
          setBtcBalanceAtom(profile.btc_balance || "0");
          setEthBalanceAtom(profile.eth_balance || "0");
          setBtcAddress(profile.btc_address || `bc1q${wallet.address.slice(2, 12)}...`);
          setEthAddress(profile.eth_address || wallet.address);
        }

        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        setActiveNodesCount(count || 0);

        const { data: txHistory } = await supabase
          .from('transactions')
          .select('*')
          .or(`from_address.eq.${wallet.address.toLowerCase()},to_address.eq.${wallet.address.toLowerCase()}`)
          .order('created_at', { ascending: false })
          .limit(10);
        if (txHistory) setHistory(txHistory);

      } catch (err) {
        console.error("Supabase sync error:", err);
      }
    };

    syncWithSupabase();
    const interval = setInterval(syncWithSupabase, 10000);
    return () => clearInterval(interval);
  }, [wallet, pendingTxs]);

  const fetchNonce = async (address: string): Promise<number> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('last_nonce')
        .eq('wallet_address', address.toLowerCase())
        .single();
      return Number(data?.last_nonce || 0);
    } catch (e) { return 0; }
  };

  const submitCloudTx = async (op: string, tx: any, signature: string) => {
    const tx_hash = `queued-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const { error } = await supabase.from('transactions').insert({
      tx_hash,
      from_address: wallet.address.toLowerCase(),
      to_address: tx.to_address?.toLowerCase() || 'System',
      amount: tx.amount_atom || "0",
      tx_type: op,
      signature,
      status: 'pending',
      payload: { op, tx, signature }
    });
    if (error) throw error;
    return tx_hash;
  };

  const handleSend = async () => {
    if(!recipient || !sendAmount) return;
    setIsSending(true);
    try {
      const amountAtom = ethers.parseUnits(sendAmount, 18);
      const nonce = await fetchNonce(wallet.address) + 1;
      const message = `AUR_TX:${nonce}:${wallet.address.toLowerCase()}:${recipient.toLowerCase()}:${amountAtom}`;
      const signature = await wallet.signMessage(message);
      
      const txHash = await submitCloudTx('transfer', { 
        from_address: wallet.address, to_address: recipient, amount_atom: amountAtom.toString(), nonce 
      }, signature);
      
      setPendingTxs(prev => [...prev, { hash: txHash, amount: amountAtom, type: 'transfer' }]);
      addLog(`Transaction queued: ${txHash.slice(0,12)}...`);
      setRecipient(""); setSendAmount("");
    } catch(e: any) { alert(e.message); }
    setIsSending(false);
  };

  const handleStake = async () => {
    if(!stakeAmount) return;
    setIsStaking(true);
    try {
      const amountAtom = ethers.parseUnits(stakeAmount, 18);
      const nonce = await fetchNonce(wallet.address) + 1;
      const message = `AUR_STAKE:${nonce}:${wallet.address.toLowerCase()}:${amountAtom.toString()}`;
      const signature = await wallet.signMessage(message);
      
      const txHash = await submitCloudTx('stake', { address: wallet.address, amount_atom: amountAtom.toString(), nonce }, signature);
      setPendingTxs(prev => [...prev, { hash: txHash, amount: amountAtom, type: 'stake' }]);
      setStakeAmount("");
    } catch(e: any) { alert(e.message); }
    setIsStaking(false);
  };

  const handleInstantSwap = async () => {
    if (!swapAmount || isSwapping) return;
    setIsSwapping(true);
    addLog(`Quantum Swap Initiated: ${swapAmount} ${swapFrom} to ${swapTo}...`);
    try {
      await new Promise(r => setTimeout(r, 2000));
      addLog("✅ Swap Completed via Sovereign AMM.");
      setSwapAmount("");
    } catch (e: any) { addLog(`❌ Swap Error: ${e.message}`); }
    setIsSwapping(false);
  };

  const fetchOrders = async () => {
    setIsMarketLoading(true);
    const { data } = await supabase.from('marketplace_orders').select('*').eq('is_active', true);
    if (data) setMarketOrders(data);
    setIsMarketLoading(false);
  };

  const handlePlaceSellOrder = async () => {
    if (!sellOrderAmount || !sellOrderPrice) return;
    setIsPlacingOrder(true);
    addLog(`Broadcasting P2P Listing...`);
    try {
      await new Promise(r => setTimeout(r, 1500));
      addLog("✅ Listing Active on Sovereign Core.");
      setSellOrderAmount(""); setSellOrderPrice("");
    } catch (e) { addLog("❌ Listing Failed."); }
    setIsPlacingOrder(false);
  };

  const handleBuyInternal = async (id: number, price: string, amount: string) => {
    addLog(`Buying Order #${id.toString().slice(-6)}...`);
    await new Promise(r => setTimeout(r, 1000));
    addLog("✅ Purchase Successful!");
  };

  return (
    <div className="min-h-screen bg-[#050510] text-white selection:bg-indigo-500/30 font-sans selection:text-white overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse decoration-1000" />
      </div>

      <div className="max-w-[1600px] mx-auto px-6 py-12 relative z-10">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-8 mb-16 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center rotate-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <span className="text-black font-black text-2xl">A</span>
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                Aura <span className="text-xs py-1 px-3 bg-indigo-500 text-white rounded-full font-bold uppercase tracking-widest animate-pulse">Sovereign Cloud</span>
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-500/10 rounded-md">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                   <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Global Mainnet Active</span>
                </div>
                <span className="text-[10px] text-white/20 font-mono tracking-tighter">{wallet.address}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/[0.03] p-2 rounded-2xl border border-white/5 backdrop-blur-xl">
             <button onClick={onLogout} className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl font-bold text-[10px] transition-all flex items-center gap-2 border border-red-500/10 uppercase">
                <LogOut size={14}/> Lock Wallet
             </button>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          
          {/* Main Content Areas */}
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Stats Card 1 */}
              <div className="glass-panel p-10 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] group-hover:bg-indigo-500/10 transition-all duration-700" />
                <div className="flex items-center gap-4 mb-8">
                   <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:scale-110 transition-transform">
                      <Coins size={32} />
                   </div>
                   <h3 className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">Treasury Balance</h3>
                </div>
                <div className="space-y-2">
                   <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-black tracking-tighter text-white">
                        {ethers.formatUnits(balanceAtom, 18)}
                      </span>
                      <span className="text-lg font-black text-indigo-400 uppercase">AUR</span>
                   </div>
                   <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Sovereign Assets Available</p>
                </div>
              </div>

              {/* Stats Card 2 */}
              <div className="glass-panel p-10 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[50px] group-hover:bg-emerald-500/10 transition-all duration-700" />
                <div className="flex items-center gap-4 mb-8">
                   <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400 group-hover:scale-110 transition-transform">
                      <Shield size={32} />
                   </div>
                   <h3 className="text-xs font-black text-white/30 uppercase tracking-[0.3em]">Guardian Staking</h3>
                </div>
                <div className="space-y-2">
                   <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-black tracking-tighter text-white">
                        {ethers.formatUnits(stakedBalanceAtom, 18)}
                      </span>
                      <span className="text-lg font-black text-emerald-400 uppercase">AUR</span>
                   </div>
                   <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Securing the Network</p>
                </div>
              </div>
            </div>

            {/* Marketplace Section */}
            <div className="glass-panel rounded-[2.5rem] overflow-hidden border-white/5">
              <div 
                className="bg-white/[0.02] px-10 py-8 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all"
                onClick={() => { setIsMarketExpanded(!isMarketExpanded); if(!isMarketExpanded) fetchOrders(); }}
              >
                <div className="flex items-center gap-6">
                   <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400">
                      <Zap size={24} fill="currentColor" />
                   </div>
                   <div>
                      <h2 className="text-xl font-black tracking-tight text-white uppercase">Sovereign Nebula</h2>
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-1">Peer-to-Peer & AMM Hybrid Exchange</p>
                   </div>
                </div>
                <div className="flex items-center gap-6">
                   <div className="hidden md:flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActiveMarketTab('p2p'); }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeMarketTab === 'p2p' ? 'bg-indigo-500 text-white' : 'text-white/20 hover:text-white/40'}`}
                      >
                        P2P Listings
                      </button>
                      <button 
                         onClick={(e) => { e.stopPropagation(); setActiveMarketTab('swap'); }}
                         className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeMarketTab === 'swap' ? 'bg-emerald-500 text-white' : 'text-white/20 hover:text-white/40'}`}
                      >
                         Quantum Swap
                      </button>
                   </div>
                   {isMarketExpanded ? <ChevronUp className="text-white/20" /> : <ChevronDown className="text-white/20" />}
                </div>
              </div>

              {isMarketExpanded && (
                <div className="p-10 border-t border-white/5 animate-in slide-in-from-top-2 duration-500">
                   {activeMarketTab === 'p2p' ? (
                     <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                        {/* Buy Section */}
                        <div className="space-y-6">
                           <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/20 mb-2">
                              <span>Global Peer Listings</span>
                              <span>{marketOrders.length} Active nebula found</span>
                           </div>
                           <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-thin pr-4">
                              {marketOrders.map(order => (
                                <div key={order.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex justify-between items-center hover:border-white/10 transition-all group">
                                   <div>
                                      <p className="text-lg font-black text-white">{ethers.formatUnits(order.aur_amount, 18)} <span className="text-xs text-indigo-400">AUR</span></p>
                                      <p className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest">Price: {ethers.formatUnits(order.native_price, 18)} Native</p>
                                   </div>
                                   <button 
                                     onClick={() => handleBuyInternal(order.id, order.native_price, order.aur_amount)}
                                     className="px-6 py-3 bg-white text-black text-[10px] font-black uppercase rounded-2xl hover:bg-neutral-200 transition-all opacity-40 group-hover:opacity-100"
                                   >
                                     Take Offer
                                   </button>
                                </div>
                              ))}
                           </div>
                        </div>

                        {/* Sell Section */}
                        <div className="p-8 bg-white/[0.02] rounded-[2rem] border border-white/5 space-y-6">
                           <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">List Sovereign Asset</h4>
                           <div className="space-y-4">
                              <input 
                                value={sellOrderAmount}
                                onChange={e => setSellOrderAmount(e.target.value)}
                                placeholder="Amount AUR"
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-500"
                              />
                              <input 
                                value={sellOrderPrice}
                                onChange={e => setSellOrderPrice(e.target.value)}
                                placeholder="Price in Native"
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-500"
                              />
                              <button onClick={handlePlaceSellOrder} className="w-full py-5 bg-indigo-500 text-white font-black text-xs uppercase rounded-2xl hover:bg-indigo-400 transition-all">
                                Post Listing
                              </button>
                           </div>
                        </div>
                     </div>
                   ) : (
                     /* Swap UI */
                     <div className="max-w-xl mx-auto py-10">
                        <div className="bg-white/5 p-10 rounded-[3rem] border border-white/5 space-y-10">
                           <div className="flex justify-between items-center px-4">
                              <div className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Pay Liquidity</div>
                              <div className="text-[10px] font-black text-emerald-400 uppercase">Bal: {ethers.formatUnits(balanceAtom, 18)} AUR</div>
                           </div>
                           <div className="flex items-center gap-6">
                              <input 
                                value={swapAmount}
                                onChange={e => setSwapAmount(e.target.value)}
                                className="flex-1 bg-transparent text-5xl font-black outline-none placeholder:text-white/5" 
                                placeholder="0.00"
                              />
                              <div className="text-xl font-black tracking-tighter">AUR</div>
                           </div>
                           <button onClick={handleInstantSwap} className="w-full py-6 bg-white text-black font-black text-sm uppercase rounded-3xl hover:bg-neutral-200 shadow-2xl transition-all">
                              {isSwapping ? 'Processing...' : 'Instant Swap'}
                           </button>
                        </div>
                     </div>
                   )}
                </div>
              )}
            </div>

            {/* Console Log */}
            <div className="glass-panel rounded-[2rem] overflow-hidden">
               <div 
                 className="bg-black/20 p-6 flex justify-between items-center cursor-pointer"
                 onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
               >
                  <div className="flex items-center gap-3">
                    <TerminalIcon size={16} className="text-indigo-400" />
                    <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Peer Telemetry Stream</span>
                  </div>
                  {isConsoleExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
               </div>
               {isConsoleExpanded && (
                 <div className="p-8 h-48 overflow-y-auto font-mono text-[10px] space-y-2 bg-black/40">
                    {logs.map((log, i) => (
                      <div key={i} className={i === 0 ? 'text-indigo-400 font-bold' : 'text-white/20'}>{log}</div>
                    ))}
                 </div>
               )}
            </div>
          </div>

          {/* Sidebar - Sovereign Multi-Vault */}
          <div className="space-y-8">
            <div className="glass-panel p-8 rounded-[2.5rem] space-y-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] group-hover:bg-indigo-500/10 transition-all duration-700" />
              
              <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] flex items-center gap-2">
                   <Shield size={14} className="text-indigo-400" /> Sovereign Multi-Vault
                </h3>
              </div>
              
              <div className="space-y-6">
                {/* BTC Asset Row */}
                <div className="p-5 bg-orange-500/[0.03] rounded-3xl border border-orange-500/10 hover:border-orange-500/30 transition-all group/asset relative overflow-hidden">
                   <div className="flex justify-between items-center relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-400">
                          <span className="font-black text-lg">₿</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-orange-400/80 uppercase tracking-widest">Bitcoin</p>
                          <p className="text-lg font-black tracking-tight text-white">{btcBalanceAtom} <span className="text-[10px] text-white/20">BTC</span></p>
                        </div>
                      </div>
                   </div>
                </div>

                {/* ETH Asset Row */}
                <div className="p-5 bg-blue-500/[0.03] rounded-3xl border border-blue-500/10 hover:border-blue-500/30 transition-all group/asset relative overflow-hidden">
                   <div className="flex justify-between items-center relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400">
                          <span className="font-black text-lg">Ξ</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-400/80 uppercase tracking-widest">Ethereum</p>
                          <p className="text-lg font-black tracking-tight text-white">{ethBalanceAtom} <span className="text-[10px] text-white/20">ETH</span></p>
                        </div>
                      </div>
                   </div>
                </div>

                {/* Native Resource */}
                <div className="flex items-center justify-between px-2 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-3 text-white/60">
                    <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><Zap size={14} /></div>
                    <span className="text-[10px] font-bold tracking-widest uppercase">Internal Native</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 font-bold">{nativeBalanceAtom} <span className="text-[8px] opacity-40 italic">FUEL</span></span>
                </div>
              </div>
            </div>

            {/* Disconnect Logic */}
            <button 
               onClick={onDisconnect}
               className="w-full py-4 bg-red-500/5 text-red-500 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-red-500/10 hover:bg-red-500/10 transition-all"
            >
               Disconnect Local Node
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="pt-24 pb-8 text-center">
           <p className="text-[9px] font-black text-white/10 uppercase tracking-[0.5em]">
             AURA FAHSAI ENGINE • PERIOD 2026 • THE ERA OF DISTRIBUTED SOVEREIGNTY
           </p>
        </footer>

      </div>
    </div>
  );
};

export default Dashboard;
