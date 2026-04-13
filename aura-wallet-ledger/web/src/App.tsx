import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import LandingPage from './ui/pages/LandingPage';
import Dashboard from './ui/pages/Dashboard';

const App: React.FC = () => {
  const [wallet, setWallet] = useState<ethers.Wallet | null>(null);
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');

  const handleLaunch = (unlockedWallet: ethers.Wallet) => {
    setWallet(unlockedWallet);
    setView('dashboard');
  };

  const handleLogout = () => {
    setWallet(null);
    setView('landing');
  };

  const handleDisconnect = () => {
    localStorage.removeItem('aura_identity_v2');
    setWallet(null);
    setView('landing');
  };

  return (
    <div className="min-h-screen">
      <div className="celestial-bg" />
      
      {view === 'landing' || !wallet ? (
        <LandingPage onLaunch={handleLaunch} />
      ) : (
        <Dashboard 
          onLogout={handleLogout} 
          onDisconnect={handleDisconnect}
          wallet={wallet} 
        />
      )}
    </div>
  );
};

export default App;
