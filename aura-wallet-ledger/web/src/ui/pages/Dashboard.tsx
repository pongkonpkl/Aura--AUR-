import React, { useState, useEffect } from 'react';
import { 
  Activity, Shield, Coins, Power, LogOut, Cpu, Globe, 
  Database, Terminal as TerminalIcon, ArrowUpRight, ArrowDownLeft, 
  X, AlertCircle, CheckCircle2, RefreshCw 
} from 'lucide-react';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [isEngineReady, setIsEngineReady] = useState(true);
  const [networkStats, setNetworkStats] = useState({ activeNodes: 0, sharedPool: '0.00' });
  const [activeModal, setActiveModal] = useState<'send' | 'receive' | null>(null);
  const [logs, setLogs] = useState<string[]>([
    'Quantum presence verified...',
    'Broadcasting sovereign heartbeats...',
    'Identity: oLP8ge13FS8oH6qUUWiPzastzGB61G5tr4gc9ksmDgbr4BUsVQ',
  ]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // Autonomous Heartbeat Loop
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:8000/network_stats');
        const data = await response.json();
        setNetworkStats({ 
          activeNodes: data.active_nodes, 
          sharedPool: data.daily_pool.toFixed(4) 
        });
        setIsEngineReady(true);
      } catch (e) {
        setIsEngineReady(false);
      }
    };

    const heartbeat = async () => {
      try {
        await fetch('http://localhost:8000/heartbeat');
        addLog('Quantum heartbeat synchronized with global ledger');
      } catch (e) {
        // Silent error, diagnostic overlay handles it
      }
    };

    fetchStats();
    heartbeat();
    
    const statsInterval = setInterval(fetchStats, 5000);
    const heartbeatInterval = setInterval(heartbeat, 30000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(heartbeatInterval);
    };
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-8 animate-in fade-in zoom-in-95 duration-1000 relative">
      
      {/* Diagnostic Overlay */}
      {!isEngineReady && (
        <div className="modal-overlay">
          <div className="modal-content text-center border-red-500/20 shadow-red-500/10">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-500 w-10 h-10 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Autonomous Link Severed</h2>
            <p className="text-white/50 mb-8 leading-relaxed">
              The Sovereign Engine (fahsai_engine.py) is unreachable. This local node requires direct communication to broadcast your presence.
            </p>
            <div className="space-y-4 text-left glass-panel p-6 rounded-2xl mb-8">
              <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Repair Protocol</p>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0">1</div>
                <p className="text-sm">Run <span className="text-indigo-400 font-mono">python fahsai_engine.py</span> locally.</p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0">2</div>
                <p className="text-sm">Allow "Insecure Content" for this site in your browser settings (Localhost communication).</p>
              </div>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="flex-1 py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 transition-all text-sm"
              >
                <RefreshCw size={18} /> Re-verify
              </button>
              <button 
                onClick={() => setIsEngineReady(true)}
                className="flex-1 py-4 bg-indigo-500/10 text-indigo-400 font-bold rounded-2xl flex items-center justify-center hover:bg-indigo-500/20 transition-all text-sm"
              >
                Offline View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {activeModal === 'send' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Initiate Transfer</h2>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Recipient Address</label>
                <input type="text" placeholder="oLP8...VQ" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Amount (AUR)</label>
                <input type="number" placeholder="0.00" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all" />
              </div>
              <button disabled className="w-full py-4 bg-indigo-600/50 text-white/50 font-bold rounded-2xl cursor-not-allowed">Insufficient Balance</button>
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
            <div className="bg-white p-4 rounded-3xl inline-block mb-8">
              <div className="w-48 h-48 bg-gray-200 rounded-2xl flex items-center justify-center text-black font-bold">QR PLACEHOLDER</div>
            </div>
            <p className="text-xs font-mono text-indigo-400 bg-indigo-500/10 py-3 rounded-xl mb-4">oLP8ge13FS8oH6qUUWiPzastzGB61G5tr4gc9ksmDgbr4BUsVQ</p>
            <p className="text-sm text-white/40">Only send AUR token to this address on the Sovereign Peer Network.</p>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header - Commander Grade */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 glass-panel rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 glass-panel-accent flex items-center justify-center rounded-2xl glow-border">
              <img src="/Aura--AUR-/aura-logo-3d.png" alt="Logo" className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gradient">Sovereign Command</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300 uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Presence Active
                </span>
                <span className="text-xs text-white/40 uppercase tracking-tighter">Identity: oLP8ge...VQ</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 mt-6 md:mt-0">
            <button 
              onClick={() => setActiveModal('send')}
              className="flex items-center gap-3 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5"
            >
              <ArrowUpRight size={18} className="text-indigo-400" />
              <span className="font-bold text-sm uppercase tracking-widest">Send</span>
            </button>
            <button 
              onClick={() => setActiveModal('receive')}
              className="flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl transition-all border border-indigo-500 font-bold"
            >
              <ArrowDownLeft size={18} />
              <span className="text-sm uppercase tracking-widest">Receive</span>
            </button>
          </div>
        </header>

        {/* Main Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
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

              {/* Shared Pool */}
              <div className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-3xl rounded-full" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <Coins size={24} />
                  </div>
                  <span className="text-sm font-bold text-white/40 uppercase tracking-widest">Celestial Treasury</span>
                </div>
                <div className="space-y-1">
                  <p className="text-5xl font-bold tracking-tighter text-white group-hover:text-purple-400 transition-colors">
                    1.000<span className="text-2xl text-white/40"> AUR</span>
                  </p>
                  <p className="text-sm text-white/30 font-medium">Daily Shared Distribution</p>
                </div>
              </div>

              {/* Presence Pulse (The replacement for manual mining) */}
              <div className="glass-panel-accent p-8 rounded-3xl relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 blur-[80px]" />
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-white/10 rounded-xl text-white relative">
                    <div className="pulse-ring" />
                    <Activity size={24} className="relative z-10" />
                  </div>
                  <span className="text-sm font-bold text-white uppercase tracking-widest">Presence Sync</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-bold">Autonomous Protocol</p>
                  <p className="text-sm text-white/40 font-medium">Auto-broadcasting heartbeats...</p>
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
              className="w-full py-4 text-xs font-bold text-white/20 hover:text-red-400 transition-all uppercase tracking-widest border border-white/5 rounded-2xl hover:border-red-400/20"
            >
              Sign out of Sovereign Node
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
