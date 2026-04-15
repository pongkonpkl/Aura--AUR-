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
  const [networkStats, setNetworkStats] = useState({ activeNodes: 0, sharedPool: '0.00' });
  const [activeModal, setActiveModal] = useState<'send' | 'receive' | 'seed' | 'stake' | 'cloud' | 'challenge' | null>(null);
  
  const [balanceAtom, setBalanceAtom] = useState<string>("0");
  const [stakedBalanceAtom, setStakedBalanceAtom] = useState<string>("0");
  const [recipient, setRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const [dailyEmission, setDailyEmission] = useState<string>("0");
  const [pendingTxs, setPendingTxs] = useState<{hash: string, amount: bigint, type: string}[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [pendingRewardAtom, setPendingRewardAtom] = useState<string>("0");
  const [isClaiming, setIsClaiming] = useState(false);
  
  const [isMarketExpanded, setIsMarketExpanded] = useState(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(false);
  const [activeMarketTab, setActiveMarketTab] = useState<'p2p' | 'swap'>('p2p');
  const [marketOrders, setMarketOrders] = useState<any[]>([]);

  const [logs, setLogs] = useState<string[]>([
    'Quantum presence verified...',
    'Broadcasting sovereign heartbeats...',
    `Identity: ${wallet.address.slice(0, 10)}...`,
  ]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 20));
  };

  // Sync Logic (Refined for Premium Performance)
  useEffect(() => {
    const syncWithSupabase = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('wallet_address', wallet.address.toLowerCase())
          .single();

        if (profile) {
          setBalanceAtom(profile.balance || "0");
          setStakedBalanceAtom(profile.staked_balance || "0");
        }

        const { data: distData } = await supabase
          .from('distributions')
          .select('amount')
          .gte('created_at', new Date(Date.now() - 86400000).toISOString());
        
        if (distData) {
          const total = distData.reduce((acc, curr) => acc + BigInt(curr.amount || "0"), 0n);
          setDailyEmission(total.toString());
        }

        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        setNetworkStats(prev => ({ ...prev, activeNodes: count || 0 }));

        // Pending rewards simulation (Local Algorithm)
        if (profile?.staked_balance && BigInt(profile.staked_balance) > 0n) {
           setPendingRewardAtom((BigInt(profile.staked_balance) / 100000n).toString()); // Visual placeholder for pulse
        }

      } catch (err) { console.error("Sync error:", err); }
    };

    syncWithSupabase();
    const interval = setInterval(syncWithSupabase, 8000);
    return () => clearInterval(interval);
  }, [wallet.address]);

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet.address);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    addLog("Address copied.");
  };

  const fetchOrders = async () => {
    const { data } = await supabase.from('marketplace_orders').select('*').eq('is_active', true);
    if (data) setMarketOrders(data);
  };

  return (
    <div className="min-h-screen bg-[#050510] text-white selection:bg-indigo-500/30 font-sans selection:text-white overflow-x-hidden">
      {/* Background Ambience */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full animate-pulse focus-within:animate-none" />
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-12 relative z-10">
        
        {/* Header - Compact Premium */}
        <header className="flex justify-between items-center mb-16 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center rotate-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <span className="text-black font-black text-2xl">A</span>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                Aura <span className="text-[10px] py-1 px-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-full font-bold uppercase tracking-widest">Sovereign Cloud</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                 <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Global Mainnet Active</span>
                 <span className="text-[10px] text-white/10 font-mono tracking-tighter opacity-50 ml-2">{wallet.address}</span>
              </div>
            </div>
          </div>
          <button onClick={onLogout} className="px-5 py-2.5 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 rounded-xl font-bold text-[10px] transition-all flex items-center gap-2 border border-white/5 uppercase tracking-widest">
            <LogOut size={14}/> Lock Wallet
          </button>
        </header>

        {/* Restore Original Grid Layout (Image 2) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Main Column (3 spans) */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Top Row: Consensus & Treasury */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Sovereign Consensus Card */}
              <div className="glass-panel p-10 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[50px] group-hover:bg-blue-500/10 transition-all duration-700" />
                <div className="flex items-center gap-4 mb-10">
                   <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-400 group-hover:rotate-12 transition-transform">
                      <Globe size={28} />
                   </div>
                   <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Sovereign Consensus</h3>
                </div>
                <div className="space-y-1">
                   <p className="text-7xl font-black tracking-tighter text-white">{networkStats.activeNodes}</p>
                   <p className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">Active Network Validators</p>
                </div>
              </div>

              {/* Celestial Treasury Card */}
              <div className="glass-panel p-10 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[50px] group-hover:bg-purple-500/10 transition-all duration-700" />
                <div className="flex items-center gap-4 mb-10">
                   <div className="p-4 bg-purple-500/10 rounded-2xl text-purple-400 group-hover:rotate-12 transition-transform">
                      <Coins size={28} />
                   </div>
                   <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Celestial Treasury</h3>
                </div>
                <div className="mb-8">
                   <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black tracking-tighter text-white">
                        {ethers.formatUnits(balanceAtom, 18).substring(0, 18)}
                      </span>
                      <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">AUR</span>
                   </div>
                   <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest mt-2">Liquid Balance (Available to Spend)</p>
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setActiveModal('send')} className="flex-1 py-4 bg-white/[0.03] border border-white/5 hover:bg-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                      <ArrowUpRight size={14} /> Send
                   </button>
                   <button onClick={() => setActiveModal('receive')} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2">
                      <ArrowDownLeft size={14} /> Receive
                   </button>
                </div>
                <button className="w-full py-4 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 text-emerald-400 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all mt-4 flex items-center justify-center gap-2">
                   <Zap size={14} fill="currentColor" /> Withdraw to MetaMask Wallet
                </button>
              </div>
            </div>

            {/* Middle Row: Staking & Pulse */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Sovereign Stake Card */}
              <div className="glass-panel p-10 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-emerald-500/5 blur-[80px] rounded-full" />
                <div className="flex justify-between items-center mb-10">
                   <div className="flex items-center gap-4">
                      <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-400">
                         <Shield size={28} />
                      </div>
                      <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Sovereign Stake</h3>
                   </div>
                   <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase rounded-lg border border-emerald-500/20 tracking-widest">Sovereign Vault</span>
                </div>
                <div className="mb-10">
                   <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black tracking-tighter text-white">
                        {ethers.formatUnits(stakedBalanceAtom, 18).substring(0, 18)}
                      </span>
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">AUR</span>
                   </div>
                   <div className="flex items-center gap-2 mt-3 text-emerald-400/60 font-black text-[10px] uppercase tracking-widest">
                      <RefreshCw size={12} className="animate-spin-slow" /> Compounding (Protocol Distribution: 100% Yield)
                   </div>
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setActiveModal('stake')} className="flex-1 py-5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20">
                      Lock & Earn Output
                   </button>
                   <button className="flex-1 py-5 bg-white/[0.03] border border-white/5 text-white/20 font-black text-[10px] uppercase tracking-widest rounded-2xl cursor-not-allowed flex items-center justify-center gap-2">
                      <Zap size={14} /> Claim Output
                   </button>
                </div>
              </div>

              {/* Network Health Pulse Card */}
              <div className="glass-panel p-10 rounded-[2.5rem] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px]" />
                <div className="flex justify-between items-center mb-10">
                   <div className="flex items-center gap-4">
                      <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400">
                         <Activity size={28} />
                      </div>
                      <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Network Health Pulse</h3>
                   </div>
                   <span className="px-3 py-1 bg-white/5 text-white/30 text-[8px] font-black uppercase rounded-lg border border-white/10 tracking-widest">Sovereign Witness</span>
                </div>
                <div className="space-y-4">
                   <div>
                      <p className="text-5xl font-black tracking-tighter text-white animate-pulse">+{ethers.formatUnits(pendingRewardAtom, 18).substring(0, 4)}</p>
                      <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mt-2">Unclaimed Protocol Yield (Live)</p>
                   </div>
                </div>
                <div className="mt-12 h-20 w-full bg-white/[0.01] rounded-2xl border border-white/5 flex items-center justify-center">
                   <div className="flex gap-1 items-end">
                      {[4, 7, 3, 8, 5, 9, 4, 6, 8, 3, 5, 7].map((h, i) => (
                        <div key={i} className="w-1 bg-indigo-500/20 rounded-full animate-bounce" style={{ height: h * 4, animationDelay: `${i * 0.1}s` }} />
                      ))}
                   </div>
                </div>
              </div>
            </div>

            {/* Marketplace Expandable Section */}
            <div className="glass-panel rounded-[2rem] overflow-hidden border-white/5">
                <div 
                  className="px-8 py-6 flex justify-between items-center cursor-pointer hover:bg-white/5 transition-all"
                  onClick={() => { setIsMarketExpanded(!isMarketExpanded); if(!isMarketExpanded) fetchOrders(); }}
                >
                   <div className="flex items-center gap-4">
                      <Zap size={20} className="text-indigo-400" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sovereign Nebula Marketplace</span>
                   </div>
                   {isMarketExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                {isMarketExpanded && (
                  <div className="p-8 border-t border-white/5 animate-in slide-in-from-top-2">
                     <div className="grid grid-cols-2 gap-4 mb-8">
                        <button onClick={() => setActiveMarketTab('p2p')} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${activeMarketTab === 'p2p' ? 'bg-indigo-600 border-indigo-500' : 'bg-white/5 border-white/5 text-white/40'}`}>P2P Exchange</button>
                        <button onClick={() => setActiveMarketTab('swap')} className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${activeMarketTab === 'swap' ? 'bg-emerald-600 border-emerald-500' : 'bg-white/5 border-white/5 text-white/40'}`}>Quantum Swap</button>
                     </div>
                     {/* Simplified Marketplace View to keep build safe */}
                     <div className="p-12 text-center border border-dashed border-white/10 rounded-3xl opacity-40">
                        <TerminalIcon size={24} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Connect to Sovereign P2P Layer to view active listings</p>
                     </div>
                  </div>
                )}
            </div>
          </div>

          {/* Sidebar (1 span) */}
          <div className="space-y-8">
            
            {/* Protocol Resources Card */}
            <div className="glass-panel p-8 rounded-[2.5rem] space-y-8">
               <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Protocol Resources</h3>
               
               <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 text-white/60">
                      <div className="p-2 bg-white/5 rounded-lg"><Cpu size={14} /></div>
                      <span className="text-[10px] font-black tracking-widest uppercase">CPU Load</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-black uppercase tracking-widest">Minimal</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 text-white/60">
                      <div className="p-2 bg-white/5 rounded-lg"><Database size={14} /></div>
                      <span className="text-[10px] font-black tracking-widest uppercase">Ledger</span>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-400 font-black uppercase tracking-widest">Synced</span>
                  </div>

                  <div className="h-px bg-white/5 my-2"></div>

                  <div className="p-5 bg-white/[0.02] rounded-2xl border border-white/5">
                    <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-3">Network Energy Progress</p>
                    <div className="flex justify-between items-end mb-3">
                      <span className="text-xl font-black">
                        {ethers.formatUnits(dailyEmission, 18).substring(0, 4)} 
                        <span className="text-[10px] text-white/20 ml-1">AUR</span>
                      </span>
                      <span className="text-[8px] text-emerald-400 font-black tracking-widest uppercase bg-emerald-500/10 px-2 py-0.5 rounded">24H Live</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981] transition-all duration-1000 ease-out" 
                        style={{ width: `${Math.min((parseFloat(ethers.formatUnits(dailyEmission || "0", 18)) / 1.0) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
               </div>
            </div>

            {/* Sovereign Bridge Card */}
            <div className="glass-panel p-8 rounded-[2.5rem] space-y-6 relative overflow-hidden group">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" className="w-6 h-6" alt="metamask" />
                  </div>
                  <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Sovereign Bridge</h3>
               </div>
               <p className="text-[9px] text-white/30 leading-relaxed font-bold">Connect MetaMask to Aura. This automatically imports the AUR token address.</p>
               <button className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-orange-600/20">
                  Add AUR to MetaMask
               </button>
            </div>

            {/* Sovereign Intel Card */}
            <div className="p-8 rounded-[2.5rem] border border-white/5 bg-transparent relative overflow-hidden">
               <Shield size={24} className="text-white/5 absolute top-4 right-4" />
               <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Sovereign Intel</h3>
               <p className="text-sm text-white/40 leading-relaxed italic opacity-80 font-medium">
                 "Your node is your shield. In the Aura network, every participant is a guardian of the collective truth."
               </p>
            </div>

            {/* Console (Sidebar Position) */}
            <div className="glass-panel rounded-2xl overflow-hidden">
               <div 
                 className="px-4 py-3 bg-black/40 flex justify-between items-center cursor-pointer"
                 onClick={() => setIsConsoleExpanded(!isConsoleExpanded)}
               >
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Telemetry</span>
                  {isConsoleExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
               </div>
               {isConsoleExpanded && (
                 <div className="p-4 h-32 overflow-y-auto font-mono text-[9px] space-y-1 bg-black/60">
                    {logs.map((log, i) => (
                      <div key={i} className={i === 0 ? 'text-indigo-400' : 'text-white/20'}>{log}</div>
                    ))}
                 </div>
               )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <footer className="pt-24 pb-8 text-center opacity-30">
           <p className="text-[9px] font-black text-white uppercase tracking-[0.6em]">
             AURA FAHSAI ENGINE • THE ERA OF DIGITAL SOVEREIGNTY
           </p>
        </footer>

      </div>
    </div>
  );
};

export default Dashboard;
