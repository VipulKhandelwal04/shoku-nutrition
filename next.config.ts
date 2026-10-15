import type { NextConfig } from 'next';

// Cache Components is opt-in in Next 16 and intentionally left off for v1: every page here is per-user and
// auth-gated, so the default dynamic rendering model is simpler. Revisit when adding cached public pages.
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google profile photos
    ],
  },
};

export default nextConfig;
