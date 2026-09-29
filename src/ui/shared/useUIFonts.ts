import { useEffect } from 'react';
import sans from '../../assets/fonts/Geist.woff2?inline';
import mono from '../../assets/fonts/GeistMono.woff2?inline';

// Buffer-backed fonts work inside Chrome shadow UI without host-page font requests
// or CSP exceptions. Private family names avoid replacing a page's own Geist.
export function useUIFonts() {
  useEffect(() => {
    const faces = [['CSSForge Geist Sans', sans], ['CSSForge Geist Mono', mono]].map(([family, data]) => {
      const bytes = Uint8Array.from(atob(data.slice(data.indexOf(',') + 1)), char => char.charCodeAt(0));
      const face = new FontFace(family, bytes, { weight: '100 900', style: 'normal', display: 'swap' });
      document.fonts.add(face);
      void face.load().catch(() => { /* Keep the centralized fallback stack if loading fails. */ });
      return face;
    });
    return () => { for (const face of faces) document.fonts.delete(face); };
  }, []);
}
