'use client';

import { useEffect } from 'react';

/** Enregistre le service worker (PWA installable). L'app fonctionne aussi sans. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* pas bloquant */
    });
  }, []);
  return null;
}
