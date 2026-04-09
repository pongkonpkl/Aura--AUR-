import React, { useState, useEffect } from 'react';
import LandingPage from './ui/pages/LandingPage';
import Dashboard from './ui/pages/Dashboard';

const App: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [view, setView] = useState<'landing' | 'dashboard'>('landing');

  useEffect(() => {
    // Check if identity exists or session is active
    const savedIdentity = localStorage.getItem('aura_identity');
    if (savedIdentity) {
      // For now, we allow auto-unlock for seamless experience
      // setIsUnlocked(true);
    }
  }, []);

  const handleLaunch = () => {
    // Navigate to dashboard
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('aura_identity');
    setView('landing');
  };

  return (
    <div className="min-h-screen">
      <div className="celestial-bg" />
      
      {view === 'landing' ? (
        <LandingPage onLaunch={handleLaunch} />
      ) : (
        <Dashboard onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
