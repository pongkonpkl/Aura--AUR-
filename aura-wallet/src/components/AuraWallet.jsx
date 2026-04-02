import React, { useState, useEffect } from 'react';

const AuraWallet = () => {
  const [balance, setBalance] = useState('0.00');
  const [address, setAddress] = useState('0x...');

  return (
    <div className="aura-container">
      <div className="glass-card">
        <h2 className="glow-text">Aura Wallet</h2>
        <p style={{ color: '#94a3b8' }}>Welcome back, Explorer</p>
        
        <div className="wallet-balance">
          {balance} <span style={{ fontSize: '1rem' }}>AUR</span>
        </div>
        
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Wallet Address</p>
          <code style={{ fontSize: '0.9rem', color: '#a855f7' }}>{address}</code>
        </div>
        
        <button className="btn-primary">
          Send AUR
        </button>
        
        <div style={{ marginTop: '20px', fontSize: '0.8rem', textAlign: 'center' }}>
          <p style={{ color: '#475569' }}>Connecting to Aura Mainnet...</p>
        </div>
      </div>
    </div>
  );
};

export default AuraWallet;
