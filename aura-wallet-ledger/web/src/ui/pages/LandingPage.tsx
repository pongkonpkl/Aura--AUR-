import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onLaunch: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Pro Entrance Animation
      const tl = gsap.timeline();
      
      tl.from('.pro-logo', {
        scale: 0.8,
        opacity: 0,
        rotateY: 90,
        duration: 1.5,
        ease: 'expo.out',
      })
      .from('.hero-title', {
        opacity: 0,
        y: 20,
        duration: 1,
        ease: 'power3.out',
      }, "-=0.5")
      .from('.hero-desc', {
        opacity: 0,
        y: 10,
        duration: 1,
      }, "-=0.8")
      .from('.hero-btn', {
        opacity: 0,
        scale: 0.9,
        duration: 1,
        ease: 'back.out(1.7)',
      }, "-=0.5");

      // Scrolly Scenes
      gsap.to('.scene-1', {
        scrollTrigger: {
          trigger: '.scene-1',
          start: 'top 80%',
          end: 'bottom 20%',
          scrub: true,
        },
        opacity: 1,
        y: 0,
        scale: 1,
      });

      gsap.to('.scene-2', {
        scrollTrigger: {
          trigger: '.scene-2',
          start: 'top 80%',
          end: 'bottom 20%',
          scrub: true,
        },
        opacity: 1,
        y: 0,
        scale: 1,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="text-white selection:bg-indigo-500/30">
      {/* Hero Section */}
      <section className="scrolly-section relative h-screen overflow-hidden">
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="w-[800px] h-[800px] bg-indigo-500/5 blur-[120px] rounded-full animate-pulse" />
        </div>

        <div className="hero-content relative z-10 flex flex-col items-center text-center max-w-5xl px-6">
          <div className="mb-12 relative group">
            <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-110 group-hover:scale-125 transition-transform duration-700" />
            <img 
              src="/Aura--AUR-/aura-logo-3d.png" 
              alt="Aura Crystal Logo" 
              className="pro-logo w-40 h-40 md:w-56 md:h-56 logo-glow relative z-10 drop-shadow-2xl"
              onError={(e) => { e.currentTarget.src = 'https://raw.githubusercontent.com/lucide-react/lucide/main/icons/shield.svg' }}
            />
          </div>
          
          <h1 className="hero-title text-6xl md:text-8xl font-bold mb-8 tracking-tighter bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent">
            Aura: Fahsai
          </h1>
          
          <p className="hero-desc text-xl md:text-2xl text-indigo-200/60 mb-12 max-w-2xl font-light leading-relaxed">
            The World’s First Autonomous Sovereign Engine.<br/>
            Truly decentralized. Purely human. Powered by your presence.
          </p>
          
          <button 
            onClick={onLaunch}
            className="hero-btn group relative px-12 py-5 bg-white text-black font-bold rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative z-10 group-hover:text-white transition-colors duration-300">Enter the Network</span>
          </button>
        </div>
      </section>

      {/* Narrative Section 1 */}
      <section className="scrolly-section scene-1 opacity-0 translate-y-10 scale-95 transition-all">
        <div className="glass-panel p-16 max-w-3xl text-center border-white/5">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Sovereignty Rewritten</h2>
          <p className="text-xl text-white/50 leading-relaxed">
            Fahsai isn’t just a wallet. It’s a local-first protocol that breathes in your own machine. Secure, private, and entirely yours. No middleman. No censorship.
          </p>
        </div>
      </section>

      {/* Narrative Section 2 */}
      <section className="scrolly-section scene-2 opacity-0 translate-y-10 scale-95 transition-all">
        <div className="glass-panel p-16 max-w-3xl text-center border-indigo-500/10">
          <h2 className="text-4xl md:text-5xl font-bold mb-8">Proof of Presence</h2>
          <p className="text-xl text-white/50 leading-relaxed">
            Fair distribution of AUR. One coin, shared by all active nodes. Aura rewards you for simply being part of the network. A true collective economy.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 text-center">
        <div className="max-w-xs mx-auto h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-12" />
        <p className="text-sm font-mono text-white/20 tracking-[0.3em] uppercase">Built for the Sovereign Era • 2026</p>
      </footer>
    </div>
  );
};

export default LandingPage;
