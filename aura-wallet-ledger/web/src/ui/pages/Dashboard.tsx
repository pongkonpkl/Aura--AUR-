import React, { useState, useEffect } from 'react';
import { Activity, Shield, Coins, Power, LogOut } from 'lucide-react';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [isMining, setIsMining] = useState(false);
  const [networkStats, setNetworkStats] = useState({ activeNodes: 0, sharedPool: '0.00' });
  const [ledger, setLedger] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:8000/network_stats');
        const data = await response.json();
        setNetworkStats({ 
          activeNodes: data.active_nodes, 
          sharedPool: data.daily_pool.toFixed(4) 
        });
      } catch (e) {
        console.error('Engine offline');
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let heartbeatInterval: any;
    if (isMining) {
      heartbeatInterval = setInterval(async () => {
        try {
          await fetch('http://localhost:8000/heartbeat');
        } catch (e) {
          console.error('Heartbeat failed');
        }
      }, 30000);
    }
    return () => clearInterval(heartbeatInterval);
  }, [isMining]);

  return (
    <div className="p-8 max-w-6xl mx-auto text-white">
      {/* Header */}
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 glass-panel flex items-center justify-center">
            <Shield className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Node Dashboard</h1>
            <p className="text-white/40 text-sm">Aura Network Sovereign Node</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
        >
          <LogOut size={18} /> Logout
        </button>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-4 text-blue-400">
            <Activity size={20} />
            <span className="text-sm font-semibold uppercase tracking-wider">Network Presence</span>
          </div>
          <p className="text-4xl font-bold">{networkStats.activeNodes}</p>
          <p className="text-white/40 text-sm mt-1">Nodes online globally</p>
        </div>

        <div className="glass-panel p-6">
          <div className="flex items-center gap-3 mb-4 text-purple-400">
            <Coins size={20} />
            <span className="text-sm font-semibold uppercase tracking-wider">Daily Mint Pool</span>
          </div>
          <p className="text-4xl font-bold">1.0000 AUR</p>
          <p className="text-white/40 text-sm mt-1">Shared among {networkStats.activeNodes} nodes</p>
        </div>

        <div className="glass-panel p-6 border-blue-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-cyan-400">
              <Power size={20} />
              <span className="text-sm font-semibold uppercase tracking-wider">PoP Mining</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={isMining}
                onChange={() => setIsMining(!isMining)}
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <p className="text-lg font-medium">{isMining ? 'Presence Active' : 'Standby'}</p>
          <p className="text-white/40 text-sm mt-1">Heartbeat every 30s</p>
        </div>
      </div>

      {/* Console Section */}
      <section className="glass-panel p-8">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live Network Stream
        </h3>
        <div className="bg-black/20 rounded-xl p-6 h-64 font-mono text-sm text-blue-300/60 overflow-y-auto">
          <p className="mb-2">&gt; Node synchronized with global UTC ledger</p>
          <p className="mb-2">&gt; Identity verified: oLP8ge...VQ</p>
          {isMining && <p className="mb-2 text-blue-400">&gt; Pulse sent to global coordinator: HTTP 200 OK</p>}
          <p className="mb-2">&gt; Waiting for midnight mint task...</p>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
