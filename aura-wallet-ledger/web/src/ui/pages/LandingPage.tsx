import React, { useRef, useLayoutEffect, useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Coins, Shield, Activity, ChevronDown, Lock, ArrowRight, UserPlus, Fingerprint, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onLaunch: (wallet: ethers.Wallet) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'create_step1' | 'create_step2' | 'import'>('login');
  const [password, setPassword] = useState('');
  const [importWords, setImportWords] = useState<string[]>(Array(12).fill(''));
  const [showNewSeed, setShowNewSeed] = useState(false);
  
  const [generatedWallet, setGeneratedWallet] = useState<ethers.Wallet | null>(null);
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);

  useEffect(() => {
    if (authMode === 'create_step1' && !generatedWallet) {
      const newWallet = ethers.Wallet.createRandom();
      setGeneratedWallet(newWallet);
      setSeedPhrase(newWallet.mnemonic?.phrase.split(' ') || []);
    }
  }, [authMode, generatedWallet]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if(password.length >= 4) {
      if ((authMode === 'create_step2' || authMode === 'import') && generatedWallet) {
        // Encrypt wallet mnemonic with pin (Works for both New and Imported)
        const phrase = generatedWallet.mnemonic?.phrase || '';
        const encryptedKey = CryptoJS.AES.encrypt(phrase, password).toString();
        localStorage.setItem('aura_identity_v2', encryptedKey);
        onLaunch(generatedWallet);
      } else if (authMode === 'login') {
        // Decrypt existing wallet with pin
        try {
          const encryptedKey = localStorage.getItem('aura_identity_v2');
          if (!encryptedKey) {
            alert('No sovereign identity found! Please create a new node.');
            return;
          }
          const bytes = CryptoJS.AES.decrypt(encryptedKey, password);
          const decryptedPhrase = bytes.toString(CryptoJS.enc.Utf8);
          if (!decryptedPhrase) throw new Error('Invalid PIN');
          
          const wallet = ethers.Wallet.fromPhrase(decryptedPhrase);
          onLaunch(wallet);
        } catch (err) {
          alert('Invalid PIN or corrupted identity.');
        }
      }
    }
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const cleanPhrase = importWords.map(w => w.trim().toLowerCase()).join(' ');
      const wallet = ethers.Wallet.fromPhrase(cleanPhrase);
      setGeneratedWallet(wallet);
      setAuthMode('create_step2'); 
    } catch (err) {
      alert('Invalid Seed Phrase. Please ensure all 12 words are correct.');
    }
  };

  const handleWordChange = (index: number, value: string) => {
    const newWords = [...importWords];
    // Handle paste of whole phrase or multiple words
    const cleanValue = value.trim().toLowerCase();
    if (cleanValue.includes(' ') || cleanValue.includes('\n') || cleanValue.includes(',')) {
      const pastedWords = cleanValue.split(/[\s,\n]+/).filter(w => w.length > 0).slice(0, 12);
      pastedWords.forEach((word, i) => {
        if (index + i < 12) newWords[index + i] = word;
      });
    } else {
      newWords[index] = cleanValue;
    }
    setImportWords(newWords);
  };

  const isWordValid = (word: string) => {
    if (!word) return true; // Don't highlight empty
    try {
      // Check against Ethers' built-in English wordlist
      return ethers.wordlists.en.getWordIndex(word) !== -1;
    } catch {
      return false;
    }
  };
  
  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
	
      // 1. Entrance Animation
      const tlEntrance = gsap.timeline();
      tlEntrance.from('.pro-logo', {
        scale: 0.1,
        opacity: 0,
        rotateY: 180,
        duration: 2,
        ease: 'power4.out',
      })
      .from('.hero-content-intro', {
        opacity: 0,
        y: 30,
        duration: 1.5,
        ease: 'power3.out',
      }, "-=1.2");

      // Animate the chevron bounce
      gsap.to('.scroll-indicator', {
        y: 10,
        repeat: -1,
        yoyo: true,
        duration: 1,
        ease: 'power1.inOut'
      });

      // Scene animations (Individual ScrollTriggers)
      gsap.utils.toArray('.story-text').forEach((element: any) => {
        gsap.from(element, {
          scrollTrigger: {
            trigger: element,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
          opacity: 0,
          y: 60,
          duration: 1.2,
          ease: 'power3.out'
        });
      });

      // Floating coins (Continuous background effect) tied to scroll
      gsap.utils.toArray('.floating-coin').forEach((coin: any) => {
        gsap.to(coin, {
          y: '-100vh',
          rotateZ: 360,
          scrollTrigger: {
            trigger: '.scrolly-container',
            start: 'top top',
            end: 'bottom bottom',
            scrub: 2,
          }
        });
      });
    }, containerRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="text-white selection:bg-indigo-500/30">
      
      {/* Skip button for better UX */}
      <button 
        onClick={() => setShowAuth(true)}
        className="fixed top-6 right-6 z-[100] px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold uppercase tracking-widest transition-all backdrop-blur-md hover:scale-105"
      >
        Skip to App
      </button>

      {showAuth && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="w-full max-w-md p-8 glass-panel rounded-3xl shadow-[0_0_50px_rgba(124,58,237,0.2)] border border-indigo-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              <div className="w-16 h-16 flex items-center justify-center rounded-full border-2 border-indigo-500/40 bg-[#0a0a1a] shadow-[0_0_15px_rgba(124,58,237,0.4)] mx-auto mb-6">
                <span className="text-3xl font-black bg-gradient-to-b from-white via-indigo-100 to-purple-400 bg-clip-text text-transparent transform translate-y-[-2%] translate-x-[2%]">
                  A
                </span>
              </div>
              
              <h2 className="text-2xl font-bold text-center mb-2">
                {authMode === 'login' ? 'Unlock Sovereign Node' : 
                 authMode === 'create_step1' ? 'Secret Recovery Phrase' : 
                 authMode === 'import' ? 'Import Sovereign Node' : 'Secure Your Node'}
              </h2>
              <p className="text-sm text-center text-white/50 mb-8">
                {authMode === 'login' 
                  ? 'Enter your 4-digit PIN to synchronize'
                  : authMode === 'create_step1' 
                  ? 'Write down these 12 words and keep them safe.'
                  : authMode === 'import'
                  ? 'Enter your 12-word recovery phrase to recover your node.'
                  : 'Create a 4-digit PIN to access this device.'
                }
              </p>

              {authMode === 'create_step1' ? (
                <div className="space-y-6">
                  <div className="relative group">
                    <div className={`grid grid-cols-3 gap-3 transition-all duration-500 ${!showNewSeed ? 'blur-md pointer-events-none select-none grayscale' : ''}`}>
                      {seedPhrase.map((word, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center justify-center gap-2">
                          <span className="text-[10px] text-white/30 font-mono">{idx + 1}</span>
                          <span className="font-mono text-xs font-bold text-indigo-300">{word}</span>
                        </div>
                      ))}
                    </div>
                    {!showNewSeed && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                         <div className="p-4 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 flex flex-col items-center gap-3">
                           <Lock className="text-indigo-400" size={24} />
                           <button 
                             onClick={() => setShowNewSeed(true)}
                             className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-full transition-all flex items-center gap-2"
                           >
                              <Eye size={14} /> Reveal Recovery Phrase
                           </button>
                         </div>
                      </div>
                    )}
                  </div>
                  
                  {showNewSeed && (
                    <button 
                      onClick={() => setAuthMode('create_step2')}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-500"
                    >
                      I've Saved Them Securely
                    </button>
                  )}
                </div>
              ) : authMode === 'import' ? (
                <form onSubmit={handleImportSubmit} className="space-y-6">
                   <div className="space-y-4">
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest block text-center">
                      Verify 12-Word Phrase
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                       {importWords.map((word, idx) => {
                         const valid = isWordValid(word);
                         return (
                           <div key={idx} className="relative group">
                              <span className="absolute left-2 top-1.5 text-[8px] font-mono text-white/20 pointer-events-none">{idx + 1}</span>
                              <input 
                                type="text"
                                value={word}
                                onChange={e => handleWordChange(idx, e.target.value)}
                                className={`w-full bg-white/5 border rounded-lg pl-5 pr-6 py-3 focus:border-indigo-500/50 outline-none transition-all font-mono text-xs ${
                                  !word ? 'border-white/10' : valid ? 'border-emerald-500/30 text-emerald-300' : 'border-red-500/50 text-red-400 bg-red-500/5'
                                }`}
                                required
                                placeholder="..."
                                autoComplete="off"
                              />
                              {word && (
                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                  {valid ? <CheckCircle2 size={10} className="text-emerald-500" /> : <AlertCircle size={10} className="text-red-500" />}
                                </div>
                              )}
                           </div>
                         );
                       })}
                    </div>
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg mt-4"
                  >
                    <UserPlus size={18} /> Recover Node Identity
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">
                      {authMode === 'login' ? '4-Digit PIN' : 'Create 4-Digit PIN'}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <input 
                        type="password" 
                        value={password}
                        onChange={e => setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••" 
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/20 font-mono text-center tracking-[1em] font-bold text-xl" 
                        required
                        minLength={4}
                        maxLength={4}
                        pattern="\d{4}"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-indigo-600/20"
                  >
                    {authMode === 'login' ? (
                      <><Fingerprint size={18} /> Authenticate & Sync</>
                    ) : (
                      <><UserPlus size={18} /> Enter Network</>
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 flex flex-col gap-2">
                {authMode === 'login' ? (
                  <>
                    <button 
                      onClick={() => { setAuthMode('create_step1'); setPassword(''); }}
                      className="text-xs font-bold text-indigo-400/50 hover:text-indigo-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full py-2"
                    >
                      Create New Sovereign Node
                      <ArrowRight size={14} />
                    </button>
                    <button 
                      onClick={() => { setAuthMode('import'); setPassword(''); }}
                      className="text-xs font-bold text-indigo-400/50 hover:text-indigo-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full py-2"
                    >
                      Import Existing Node
                      <ArrowRight size={14} />
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => { setAuthMode('login'); setPassword(''); setGeneratedWallet(null); }}
                    className="text-xs font-bold text-indigo-400/50 hover:text-indigo-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full py-3"
                  >
                    Return to Login
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
              
              <div className="mt-4 text-center">
                 <button onClick={() => setShowAuth(false)} className="text-xs text-white/30 hover:text-white transition-colors">Return to Landing</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="scrolly-container relative">
        {/* Dynamic Background Overlay */}
        <div className="celestial-overlay fixed inset-0 z-0 bg-[#050510]" />

        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center relative z-10 px-6">
          <div className="flex flex-col items-center pointer-events-none mb-12">
            <div className="relative group">
              <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-125" />
              <div className="pro-logo w-48 h-48 md:w-64 md:h-64 flex items-center justify-center relative z-10 drop-shadow-[0_0_40px_rgba(124,58,237,0.6)] rounded-full border-[3px] border-indigo-500/40 bg-[#0a0a1a]">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 via-transparent to-purple-600/30 rounded-full" />
                <span className="text-[7rem] md:text-[9.5rem] leading-none font-black bg-gradient-to-b from-white via-indigo-100 to-purple-400 bg-clip-text text-transparent transform translate-y-[-2%] translate-x-[2%] font-sans tracking-tighter">
                  A
                </span>
              </div>
            </div>
          </div>
          
          <div className="hero-content-intro text-center">
            <h1 className="text-6xl md:text-9xl font-extrabold mb-4 tracking-tighter bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent drop-shadow-2xl">
              AUR
            </h1>
            <p className="text-xl md:text-2xl text-indigo-200/80 font-light leading-relaxed mb-12">
              The Sovereign Protocol for Autonomous Wealth
            </p>
            <div className="flex flex-col items-center gap-2 opacity-60">
              <span className="text-xs uppercase tracking-[0.3em] font-mono">Scroll to Discover</span>
              <ChevronDown className="scroll-indicator w-5 h-5" />
            </div>
          </div>

          {/* Background Coins */}
          {[...Array(12)].map((_, i) => (
             <Coins 
               key={i} 
               size={30 + Math.random() * 50} 
               className="floating-coin drop-shadow-2xl text-yellow-400/30"
               style={{ left: `${10 + Math.random() * 80}%`, top: `${Math.random() * 100}%` }} 
             />
          ))}
        </section>

        {/* Scene 1 */}
        <section className="min-h-screen flex items-center justify-center py-20 relative z-10">
          <div className="story-text scene-1 story-text-glass">
            <Shield className="w-12 h-12 text-indigo-400 mx-auto mb-6 opacity-80" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Sovereignty Rewritten</h2>
            <p className="text-lg md:text-2xl text-white/70 leading-relaxed font-light">
              AUR isn’t just a wallet. It’s a local-first protocol that breathes in your own machine. Secure, private, and entirely yours. No middleman. No censorship.
            </p>
          </div>
        </section>

        {/* Scene 2 */}
        <section className="min-h-screen flex items-center justify-center py-20 relative z-10">
          <div className="story-text scene-2 story-text-glass border-blue-500/20 shadow-blue-500/10">
            <Activity className="w-12 h-12 text-blue-400 mx-auto mb-6 opacity-80" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Proof of Presence</h2>
            <p className="text-lg md:text-2xl text-white/70 leading-relaxed font-light">
              We eliminated toxic mining power races. With Aura, your physical and digital presence is the proof. A true heartbeat of the network.
            </p>
          </div>
        </section>

        {/* Scene 3 */}
        <section className="min-h-screen flex items-center justify-center py-20 relative z-10">
          <div className="story-text scene-3 story-text-glass border-purple-500/20 shadow-purple-500/10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-purple-100">Absolute Fair Distribution</h2>
            <p className="text-lg md:text-2xl text-white/70 leading-relaxed font-light mb-4">
              One central pool. Shared equally by all active nodes. Aura rewards you simply for participating.
            </p>
            <p className="text-sm md:text-lg text-purple-400/80 font-mono tracking-[0.2em] uppercase">The Celestial Economy</p>
          </div>
        </section>

        {/* Scene 4 (CTA) */}
        <section className="min-h-screen flex items-center justify-center py-20 relative z-10">
          <div className="story-text scene-4">
            <button 
              onClick={() => setShowAuth(true)}
              className="group relative px-12 py-5 md:px-16 md:py-6 bg-white text-black font-bold rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 text-lg md:text-xl shadow-[0_0_40px_rgba(255,255,255,0.3)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative z-10 group-hover:text-white transition-colors duration-300">Enter the Network</span>
            </button>
            <div className="mt-8 text-center">
               <p className="text-xs font-mono text-white/30 tracking-[0.3em] uppercase">Built for the Sovereign Era • 2026</p>
            </div>
          </div>
        </section>
      </div>
      
    </div>
  );
};

export default LandingPage;
