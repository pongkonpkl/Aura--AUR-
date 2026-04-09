import React, { useRef, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Coins, Shield, Activity, ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface LandingPageProps {
  onLaunch: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
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

      // 2. Scrollytelling Master Timeline
      const masterTl = gsap.timeline({
        scrollTrigger: {
          trigger: '.scrolly-container',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1, // Smooth scrubbing
        }
      });

      // Background color animation
      masterTl.to('.celestial-overlay', {
        backgroundColor: 'rgba(124, 58, 237, 0.15)',
        duration: 1
      }, 0);

      // Hero content fades out fast
      masterTl.to('.hero-content-intro', {
        opacity: 0,
        y: -50,
        duration: 0.5
      }, 0);

      // Logo Animation (Stays Pinned, but scales and moves)
      masterTl.to('.pro-logo', {
        scale: 0.5,
        y: -100, // Move Logo up slightly
        rotateZ: 45,
        duration: 1
      }, 0);

      // Scene 1: Sovereignty Text Fades In then Out
      masterTl.to('.scene-1', { opacity: 1, y: 0, duration: 0.5 }, 0.5)
              .to('.scene-1', { opacity: 0, y: -20, duration: 0.5 }, 1.5);

      // Scene 2: Proof of Presence
      masterTl.to('.pro-logo', {
        scale: 0.7,
        y: 0,
        rotateZ: -45,
        duration: 1
      }, 1.5);
      
      masterTl.to('.celestial-overlay', {
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        duration: 1
      }, 1.5);

      masterTl.to('.scene-2', { opacity: 1, y: 0, duration: 0.5 }, 2)
              .to('.scene-2', { opacity: 0, y: -20, duration: 0.5 }, 3);

      // Scene 3: The Coins Floating
      masterTl.to('.scene-3', { opacity: 1, y: 0, duration: 0.5 }, 3.5);
      
      // Floating coins animation tied to scroll
      gsap.utils.toArray('.floating-coin').forEach((coin: any, index: number) => {
        masterTl.fromTo(coin, 
          { y: '100vh', opacity: 0, rotateZ: Math.random() * 90 },
          { y: '-100vh', opacity: Math.random() * 0.5 + 0.2, rotateZ: Math.random() * 360 + 180, duration: 1.5 + (Math.random()) },
          3 + (index * 0.1) // Start while Scene 3 text is showing
        );
      });

      masterTl.to('.scene-3', { opacity: 0, y: -20, duration: 0.5 }, 5);
      
      // Scene 4: The Final Action (Button)
      masterTl.to('.pro-logo', {
        scale: 1,
        y: -50,
        rotateZ: 0,
        duration: 1
      }, 5);
      
      masterTl.to('.celestial-overlay', {
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        duration: 1
      }, 5);

      masterTl.fromTo('.scene-4', 
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.5 }, 5.5
      );

    }, containerRef);
    
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="text-white selection:bg-indigo-500/30">
      
      {/* Skip button for better UX */}
      <button 
        onClick={onLaunch}
        className="fixed top-6 right-6 z-[100] px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold uppercase tracking-widest transition-all backdrop-blur-md hover:scale-105"
      >
        Skip to App
      </button>

      <div className="scrolly-container">
        {/* Dynamic Background Overlay */}
        <div className="celestial-overlay fixed inset-0 z-0 bg-transparent transition-colors duration-1000 pointer-events-none" />

        {/* Pinned Section */}
        <div className="pin-section fixed top-0 left-0 w-full h-screen">
          
          {/* THE LOGO (Always present, transforms on scroll) */}
          <div className="absolute z-10 flex flex-col items-center w-full pointer-events-none top-[15vh]">
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

          {/* Floating Coins (Hidden initially, animated via GSAP) */}
          {[...Array(12)].map((_, i) => (
             <Coins 
               key={i} 
               size={30 + Math.random() * 50} 
               className="floating-coin drop-shadow-2xl text-yellow-400/30"
               style={{ left: `${10 + Math.random() * 80}%` }} 
             />
          ))}

          {/* INITIAL HERO CONTENT */}
          <div className="hero-content-intro absolute z-20 flex flex-col items-center text-center w-full px-6 top-[58vh]">
            <h1 className="text-6xl md:text-8xl font-bold mb-4 tracking-tighter bg-gradient-to-b from-white via-white to-white/40 bg-clip-text text-transparent drop-shadow-2xl">
              Aura: Fahsai
            </h1>
            <p className="text-xl md:text-2xl text-indigo-200/80 font-light leading-relaxed mb-6">
              The World's First Autonomous Sovereign Engine
            </p>
            <div className="flex flex-col items-center gap-2 opacity-60">
               <span className="text-xs uppercase tracking-[0.3em] font-mono">Scroll to Discover</span>
               <ChevronDown className="scroll-indicator w-5 h-5" />
            </div>
          </div>

          {/* SCENE 1 */}
          <div className="story-text scene-1 story-text-glass translate-y-10">
            <Shield className="w-12 h-12 text-indigo-400 mx-auto mb-6 opacity-80" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Sovereignty Rewritten</h2>
            <p className="text-lg md:text-2xl text-white/70 leading-relaxed font-light">
              Fahsai isn’t just a wallet. It’s a local-first protocol that breathes in your own machine. Secure, private, and entirely yours. No middleman. No censorship.
            </p>
          </div>

          {/* SCENE 2 */}
          <div className="story-text scene-2 story-text-glass translate-y-10 border-blue-500/20 shadow-blue-500/10">
            <Activity className="w-12 h-12 text-blue-400 mx-auto mb-6 opacity-80" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Proof of Presence</h2>
            <p className="text-lg md:text-2xl text-white/70 leading-relaxed font-light">
              We eliminated toxic mining power races. With Aura, your physical and digital presence is the proof. A true heartbeat of the network.
            </p>
          </div>

          {/* SCENE 3 */}
          <div className="story-text scene-3 story-text-glass translate-y-10 border-purple-500/20 shadow-purple-500/10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-purple-100">Absolute Fair Distribution</h2>
            <p className="text-lg md:text-2xl text-white/70 leading-relaxed font-light mb-4">
              One central pool. Shared equally by all active nodes. Aura rewards you simply for participating.
            </p>
            <p className="text-sm md:text-lg text-purple-400/80 font-mono tracking-[0.2em] uppercase">The Celestial Economy</p>
          </div>

          {/* SCENE 4 (CTA) */}
          <div className="story-text scene-4 mt-20">
            <button 
              onClick={onLaunch}
              className="group relative px-12 py-5 md:px-16 md:py-6 bg-white text-black font-bold rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 text-lg md:text-xl shadow-[0_0_40px_rgba(255,255,255,0.3)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="relative z-10 group-hover:text-white transition-colors duration-300">Enter the Network</span>
            </button>
            <div className="mt-8">
               <p className="text-xs font-mono text-white/30 tracking-[0.3em] uppercase">Built for the Sovereign Era • 2026</p>
            </div>
          </div>

        </div>
      </div>
      
    </div>
  );
};

export default LandingPage;
