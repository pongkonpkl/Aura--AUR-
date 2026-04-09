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
      // Beat 1: Entrance
      gsap.from('.hero-content', {
        opacity: 0,
        y: 50,
        duration: 2,
        ease: 'power4.out',
      });

      // Beat 2-5: Narrative Scrollytelling
      gsap.to('.scene-1', {
        scrollTrigger: {
          trigger: '.scene-1',
          start: 'top center',
          end: 'bottom center',
          scrub: 1,
        },
        opacity: 1,
        y: 0,
      });

      gsap.to('.scene-2', {
        scrollTrigger: {
          trigger: '.scene-2',
          start: 'top center',
          end: 'bottom center',
          scrub: 1,
        },
        scale: 1.1,
        opacity: 1,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="text-white">
      {/* Hero Section */}
      <section className="scrolly-section hero-section h-screen">
        <div className="hero-content text-center max-w-4xl">
          <div className="aura-loader w-24 h-24 mb-8 mx-auto bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full blur-xl opacity-50" />
          <h1 className="text-7xl font-bold mb-6 glow-text">Aura: Fahsai</h1>
          <p className="text-xl text-blue-200/70 mb-10 tracking-wide font-light">
            Bringing the Sovereign Stack to Earth. Decentralized. Human. Local.
          </p>
          <button 
            onClick={onLaunch}
            className="btn-celestial text-lg px-12 py-4"
          >
            Enter the Network
          </button>
        </div>
      </section>

      {/* Narrative Section 1 */}
      <section className="scrolly-section scene-1 opacity-20">
        <div className="glass-panel p-12 max-w-2xl text-center">
          <h2 className="text-4xl font-semibold mb-6">The Sovereign Engine</h2>
          <p className="text-lg text-white/60">
            A local-first protocol that breathes in your own machine. Secure, private, and entirely yours.
          </p>
        </div>
      </section>

      {/* Narrative Section 2 */}
      <section className="scrolly-section scene-2 opacity-20">
        <div className="glass-panel p-12 max-w-2xl text-center border-blue-500/20">
          <h2 className="text-4xl font-semibold mb-6">Celestial Treasury</h2>
          <p className="text-lg text-white/60">
            Fair distribution of AUR. One coin, shared by all active nodes. A true collective economy.
          </p>
        </div>
      </section>

      {/* Footer */}
      <section className="py-20 text-center opacity-50">
        <p>© 2026 Aura Network • Built for Sovereignty</p>
      </section>
    </div>
  );
};

export default LandingPage;
