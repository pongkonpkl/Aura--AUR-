import { useEffect, useRef } from 'react';

export function useHeartbeat({
  intervalMs = 5 * 60 * 1000,
  incrementMinutes = 5,
  endpoint = 'http://localhost:4000/heartbeat', // Defaults to Guardian Node local API
  getAddress
}) {
  const timerRef = useRef(null);
  const backoffRef = useRef(1);

  const sendPing = async () => {
    const address = getAddress();
    if (!address) return;
    
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, incrementMinutes })
      });
      backoffRef.current = 1;
      console.log(`[Heartbeat] Pinged successfully for ${address.slice(0, 6)}...`);
    } catch (err) {
      // Exponential backoff
      backoffRef.current = Math.min(backoffRef.current * 2, 8);
      console.error('[Heartbeat] Error connecting to server:', err);
    }
  };

  useEffect(() => {
    // Send initial ping
    sendPing();

    const tick = async () => {
      // Only ping if window is active
      if (document.hidden) return;
      await sendPing();
    };

    timerRef.current = window.setInterval(tick, intervalMs);

    // Send final ping on unload
    const flush = () => {
      const address = getAddress();
      if (!address) return;
      navigator.sendBeacon(endpoint, JSON.stringify({ address, incrementMinutes: 1 }));
    };

    const onVisibilityChange = () => {
      if (!document.hidden) sendPing();
    };

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', flush);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', flush);
    };
  }, [endpoint, intervalMs, incrementMinutes, getAddress]);
}
