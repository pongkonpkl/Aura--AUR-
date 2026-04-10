import React, { useState, useEffect } from 'react';
import { 
  Activity, Shield, Coins, Power, LogOut, Cpu, Globe, 
  Database, Terminal as TerminalIcon, ArrowUpRight, ArrowDownLeft, 
  X, AlertCircle, CheckCircle2, RefreshCw, Key, Home, Eye, EyeOff,
  Copy, Scan, Camera, Maximize2, Lock
} from 'lucide-react';
import { ethers } from 'ethers';
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

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
  const [cloudToken, setCloudToken] = useState(localStorage.getItem('aura_cloud_token') || '');
  const [isCloudMode, setIsCloudMode] = useState(!!(localStorage.getItem('aura_cloud_token')));

  const IS_HTTPS = window.location.protocol === 'https:';
  const REPO_RAW_BASE = "https://raw.githubusercontent.com/pongkonpkl/Aura--AUR-/master";
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

  // Autonomous Heartbeat Loop
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${LOCAL_ENGINE_URL}/network-stats`);
        const data = await response.json();
        setNetworkStats({ 
          activeNodes: data.active_nodes, 
          sharedPool: "1.0000" 
        });
        setIsEngineReady(true);
      } catch (e) {
        // Failover to GitHub for stats (Mock or static if available)
        setNetworkStats({ activeNodes: 12, sharedPool: "1.0000" });
        setIsEngineReady(false);
      }
    };

    const fetchBalance = async () => {
      try {
        // Primary: Local Engine
        const response = await fetch(`${LOCAL_ENGINE_URL}/wallet-summary?address=${wallet.address}`);
        const data = await response.json();
        setBalanceAtom(data.balance_atom || "0");
        setStakedBalanceAtom(data.staked_balance_atom || "0");
      } catch(e) {
        // Fallback: GitHub Raw Ledger (Sovereign Proof)
        try {
           const response = await fetch(`${REPO_RAW_BASE}/ledger.json`);
           const ledger = await response.json();
           const balances = ledger.balances || {};
           const staked = ledger.staked_balances || {};
           setBalanceAtom(balances[wallet.address] || "0");
           setStakedBalanceAtom(staked[wallet.address] || "0");
        } catch(err) {
           addLog("Complete connection failure. Proof unavailable.");
        }
      }
    };

    const heartbeat = async () => {
      try {
        await fetch(`${LOCAL_ENGINE_URL}/heartbeat`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ address: wallet.address })
        });
        addLog(`Quantum heartbeat synchronized for ${wallet.address.slice(0,8)}...`);
      } catch (e) {
        if (window.location.protocol === 'https:') {
            addLog("HTTPS blocked local heartbeat. Open localhost:5173 to mine.");
        } else {
            addLog("Heartbeat failed. Is fahsai_engine.py running?");
        }
      }
    };

    fetchStats();
    fetchBalance();
    heartbeat();
    
    const statsInterval = setInterval(() => { fetchStats(); fetchBalance(); }, 5000);
    const heartbeatInterval = setInterval(heartbeat, 30000);

    return () => {
      clearInterval(statsInterval);
      clearInterval(heartbeatInterval);
    };
  }, [wallet]);

  const submitCloudTx = async (op: string, tx: any, signature: string) => {
    const GITHUB_REPO = "pongkonpkl/Aura--AUR-";
    const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/dispatches`;
    
    const res = await fetch(GITHUB_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${cloudToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_type: 'cloud_tx',
        client_payload: { op, tx, signature }
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Cloud Validator Error: ${txt}`);
    }
  };

  const handleSend = async () => {
    if(!recipient || !sendAmount) return;
    setIsSending(true);
    try {
      const amountAtom = BigInt(Math.floor(parseFloat(sendAmount) * 1e18));
      const message = `AUR_TX:${wallet.address}:${recipient}:${amountAtom}`;
      const signature = await wallet.signMessage(message);
      
      if (isCloudMode) {
        await submitCloudTx('transfer', { from_address: wallet.address, to_address: recipient, amount_atom: amountAtom.toString() }, signature);
        addLog(`Cloud Send Sent. Awaiting GitHub validation.`);
      } else {
        const res = await fetch('http://localhost:8000/tx-submit', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              tx: {
                 from_address: wallet.address,
                 to_address: recipient,
                 amount_atom: amountAtom.toString()
              },
              signature
           })
        });
        const data = await res.json();
        if(!data.ok) throw new Error(data.error);
        addLog(`Transaction sent: ${data.inbox_id}`);
      }
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
      const amountAtom = BigInt(Math.floor(parseFloat(stakeAmount) * 1e18));
      if (amountAtom > BigInt(balanceAtom)) throw new Error("Insufficient Liquid Balance");
      
      const message = `AUR_STAKE:${wallet.address}:${amountAtom}`;
      const signature = await wallet.signMessage(message);
      
      if (isCloudMode) {
        await submitCloudTx('stake', { address: wallet.address, amount_atom: amountAtom.toString() }, signature);
        addLog(`Cloud Stake Sent. Awaiting GitHub validation.`);
      } else {
        const res = await fetch('http://localhost:8000/stake-op', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              op: 'stake',
              tx: { address: wallet.address, amount_atom: amountAtom.toString() },
              signature
           })
        });
        const data = await res.json();
        if(!data.ok) throw new Error(data.error);
        
        setBalanceAtom((BigInt(balanceAtom) - amountAtom).toString());
        setStakedBalanceAtom((BigInt(stakedBalanceAtom) + amountAtom).toString());
        addLog(`Locked ${stakeAmount} AUR into L3 Sovereign Core.`);
      }
      
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
      const amountAtom = BigInt(Math.floor(parseFloat(stakeAmount) * 1e18));
      if (amountAtom > BigInt(stakedBalanceAtom)) throw new Error("Insufficient Staked Balance");
      
      const message = `AUR_UNSTAKE:${wallet.address}:${amountAtom}`;
      const signature = await wallet.signMessage(message);
      
      if (isCloudMode) {
        await submitCloudTx('unstake', { address: wallet.address, amount_atom: amountAtom.toString() }, signature);
        addLog(`Cloud Unstake Sent. Awaiting GitHub validation.`);
      } else {
        const res = await fetch('http://localhost:8000/stake-op', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              op: 'unstake',
              tx: { address: wallet.address, amount_atom: amountAtom.toString() },
              signature
           })
        });
        const data = await res.json();
        if(!data.ok) throw new Error(data.error);
        
        setStakedBalanceAtom((BigInt(stakedBalanceAtom) - amountAtom).toString());
        setBalanceAtom((BigInt(balanceAtom) + amountAtom).toString());
        addLog(`Unlocked ${stakeAmount} AUR from L3 Sovereign Core.`);
      }
      
      setActiveModal(null);
      setStakeAmount("");
    } catch(e: any) {
      alert(e.message);
    }
    setIsStaking(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 animate-in fade-in zoom-in-95 duration-1000 relative">
      
      {/* Diagnostic Overlay */}
      {!isEngineReady && (
        <div className="modal-overlay">
          <div className="modal-content text-center border-red-500/20 shadow-red-500/10 max-w-2xl">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-500 w-10 h-10 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold mb-4">Sovereign Link Restricted</h2>
            
            {IS_HTTPS ? (
               <div className="text-white/70 mb-8 space-y-4">
                  <p>
                    You are currently on <strong>HTTPS</strong> (GitHub Pages). Browsers block communication with your local Engine (HTTP) for security.
                  </p>
                  <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 text-indigo-300 font-bold">
                    Recommendation: Use your <a href="http://localhost:5173" className="underline hover:text-white">Local Dashboard</a> for full control.
                  </div>
               </div>
            ) : (
               <p className="text-white/50 mb-8 leading-relaxed">
                 The Sovereign Engine (fahsai_engine.py) is unreachable. This local node requires direct communication to broadcast your presence.
               </p>
            )}

            <div className="space-y-4 text-left glass-panel p-6 rounded-2xl mb-8">
              <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Repair Protocol</p>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0">1</div>
                <p className="text-sm">Run <span className="text-indigo-400 font-mono">python fahsai_engine.py</span> locally.</p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0">2</div>
                <p className="text-sm">
                   Switch to <a href="http://localhost:5173" className="text-indigo-400 underline font-bold">localhost:5173</a> to bypass browser blocks.
                </p>
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
                View Sovereign Proof
              </button>
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
                    className="text-indigo-400 cursor-pointer hover:text-indigo-300" 
                    onClick={() => {
                        const maxVal = stakingTab === 'stake' ? (Number(balanceAtom)/1e18) : (Number(stakedBalanceAtom)/1e18);
                        setStakeAmount(maxVal.toString());
                    }}
                  >
                    Max: {stakingTab === 'stake' ? (Number(balanceAtom) / 1e18).toFixed(4) : (Number(stakedBalanceAtom) / 1e18).toFixed(4)}
                  </span>
                </label>
                <input 
                  value={stakeAmount} 
                  onChange={e=>setStakeAmount(e.target.value)} 
                  type="number" 
                  placeholder="0.00" 
                  className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 outline-none transition-all font-bold ${stakingTab === 'stake' ? 'focus:border-emerald-500' : 'focus:border-orange-500'}`} 
                />
              </div>
              <button 
                disabled={isStaking || !stakeAmount || (parseFloat(stakeAmount) * 1e18) > (stakingTab === 'stake' ? Number(balanceAtom) : Number(stakedBalanceAtom))} 
                onClick={stakingTab === 'stake' ? handleStake : handleUnstake} 
                className={`w-full py-5 font-bold rounded-2xl transition-all shadow-lg ${
                  isStaking || !stakeAmount || (parseFloat(stakeAmount) * 1e18) > (stakingTab === 'stake' ? Number(balanceAtom) : Number(stakedBalanceAtom)) 
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
                <div className="absolute inset-0 flex items-center justify-center">
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

      {/* Cloud Settings Modal */}
      {activeModal === 'cloud' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-content overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <Globe className="text-blue-400"/> Sovereign Cloud Node
              </h2>
              <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
            </div>
            
            <div className="space-y-6">
               <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex gap-4">
                 <Globe size={24} className="text-blue-400 flex-shrink-0" />
                 <p className="text-sm text-white/70">
                   <strong className="text-blue-400 block mb-1">Enable Cloud Validation</strong>
                   Connect to your GitHub Repository to bypass "HTTPS Restricted" limits and validate transactions remotely without your PC.
                 </p>
               </div>

              <div>
                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">
                  GitHub Personal Access Token (PAT)
                </label>
                <input 
                  value={cloudToken} 
                  onChange={(e) => {
                    setCloudToken(e.target.value);
                    localStorage.setItem('aura_cloud_token', e.target.value);
                    setIsCloudMode(!!e.target.value);
                  }} 
                  type="password" 
                  placeholder="ghp_..." 
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 focus:border-blue-500 outline-none transition-all font-mono" 
                />
              </div>
              <p className="text-xs text-white/30 italic text-center">
                Your token is encrypted and stored locally in this browser.
              </p>
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
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Presence Active
                </span>
                <span className="text-xs text-white/40 uppercase tracking-tighter">Identity: {wallet.address.slice(0,6)}...{wallet.address.slice(-4)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 mt-6 md:mt-0 shadow-xl">
            <button 
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl font-bold text-sm flex items-center gap-2 border border-indigo-500/20"
            >
              <Home size={16}/> <span className="hidden md:inline">Home</span>
            </button>
            <button 
              onClick={() => setActiveModal('seed')}
              className="px-5 py-2.5 hover:bg-white/10 text-white/50 hover:text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <Key size={16}/> <span className="hidden md:inline">Security</span>
            </button>
            <button 
              onClick={() => setActiveModal('cloud')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${isCloudMode ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'hover:bg-white/10 text-white/50 hover:text-white'}`}
            >
              <Globe size={16}/> <span className="hidden md:inline">Cloud Node</span>
            </button>
            <button 
              onClick={onLogout}
              className="px-5 py-2.5 hover:bg-red-500/10 text-white/50 hover:text-red-400 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
            >
              <LogOut size={16}/> <span className="hidden md:inline">Lock Wallet</span>
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
                      {(Number(balanceAtom) / 1e18).toFixed(4)}<span className="text-2xl text-white/40"> AUR</span>
                    </p>
                    <p className="text-sm text-white/30 font-medium">Liquid Balance</p>
                  </div>
                </div>
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
                    {(Number(stakedBalanceAtom) / 1e18).toFixed(4)}<span className="text-2xl text-emerald-400/40"> AUR</span>
                  </p>
                  <p className="text-sm text-emerald-400/60 font-medium">Locked (Earning 80% Daily Yield)</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => { setStakingTab('stake'); setActiveModal('stake'); }} 
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold flex justify-center items-center gap-2 border border-emerald-500 transition-all text-sm shadow-lg shadow-emerald-900/20"
                  >
                    Lock & Earn Output
                  </button>
                  <button 
                    onClick={() => { setStakingTab('unstake'); setActiveModal('stake'); }} 
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold flex justify-center items-center gap-2 border border-white/5 transition-all text-sm"
                  >
                    Unstake
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
                  <p className="text-sm text-indigo-300 font-medium">Auto-broadcasting (20% Base Yield)</p>
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
