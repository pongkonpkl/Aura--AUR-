import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useHeartbeat } from '../hooks/useHeartbeat';

const AuraWallet = () => {
  const [balance, setBalance] = useState('0.00');
  const [address, setAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [uptimeMinutes, setUptimeMinutes] = useState(0);

  // 🔴 Heartbeat Integration: Sends ping every 1 minute
  useHeartbeat({
    getAddress: () => (isConnected && address ? address : null),
    endpoint: 'http://localhost:4000/heartbeat',
    intervalMs: 1 * 60 * 1000, // 1 minute for faster testing
    incrementMinutes: 1
  });

  // Local effect to simulate uptime ticking up in the UI
  useEffect(() => {
    let timer;
    if (isConnected) {
      timer = setInterval(() => {
        if (!document.hidden) {
          setUptimeMinutes((prev) => prev + 1);
        }
      }, 60000); // UI increments every minute
    }
    return () => clearInterval(timer);
  }, [isConnected]);

  // Connect Wallet Logic
  const handleConnect = async () => {
    try {
      if (window.ethereum) {
        // Connect via MetaMask / Web3 Provider
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        setAddress(accounts[0]);
        setIsConnected(true);
      } else {
        // Fallback: Generate local wallet identity to enable Eternity Mining for everyone
        const randomWallet = ethers.Wallet.createRandom();
        setAddress(randomWallet.address);
        setIsConnected(true);
        alert("Generated New Web3 Identity for you!");
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
      alert("Connection failed. Try again.");
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAddress('');
    setUptimeMinutes(0);
  };

  const estimatedShare = (uptimeMinutes * 0.0001).toFixed(4);

  return (
    <div className="aura-container">
      <div className="glass-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="glow-text" style={{ margin: 0 }}>Aura Wallet</h2>
          {isConnected && (
            <button onClick={handleDisconnect} style={{ background: 'transparent', border: '1px solid #475569', color: '#94a3b8', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }}>
              Disconnect
            </button>
          )}
        </div>
        
        {!isConnected ? (
          // --- NOT CONNECTED SCREEN ---
          <div style={{ textAlign: 'center', marginTop: '40px', marginBottom: '20px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>🛡️</div>
            <p style={{ color: '#94a3b8', marginBottom: '30px' }}>Connect to the Eternity Pool</p>
            <button className="btn-primary" onClick={handleConnect} style={{ width: '100%', padding: '12px' }}>
              Connect Web3 Wallet
            </button>
            <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '15px' }}>
              No plugin? We'll create a sovereign identity for you.
            </p>
          </div>
        ) : (
          // --- CONNECTED DASHBOARD ---
          <>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '8px' }}>Welcome back, Explorer</p>
            
            {/* Balance Card */}
            <div className="wallet-balance" style={{ marginTop: '20px', borderBottom: '1px solid #334155', paddingBottom: '20px' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                {balance} <span style={{ fontSize: '1.2rem', color: '#a855f7' }}>AUR</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '8px' }}>
                <code>{address.slice(0, 6)}...{address.slice(-4)}</code>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn-primary" style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #a855f7' }}>
                ⬇️ Receive
              </button>
              <button className="btn-primary" style={{ flex: 1 }}>
                ⬆️ Send
              </button>
            </div>

            {/* Eternity Mining Stats */}
            <div style={{ marginTop: '30px', backgroundColor: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', padding: '16px', border: '1px solid #1e293b' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>⛏️</span> Eternity Mining Dashboard
              </h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Active Session Uptime</span>
                <strong style={{ color: '#38bdf8' }}>{uptimeMinutes} Mins</strong>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Est. Midnight Share</span>
                <strong style={{ color: '#a855f7' }}>~ {estimatedShare} AUR</strong>
              </div>

              {/* Progress/Activity Bar */}
              <div style={{ height: '6px', width: '100%', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(10 + uptimeMinutes, 100)}%`, background: 'linear-gradient(90deg, #a855f7, #38bdf8)', transition: 'width 1s ease' }}></div>
              </div>
            </div>
            
            {/* Status Footer */}
            <div style={{ marginTop: '24px', fontSize: '0.8rem', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
              <span className="pulse-dot" style={{ height: '8px', width: '8px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 8px #22c55e' }}></span>
              <p style={{ color: '#475569', margin: 0 }}>Eternity Pool Synced</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuraWallet;
