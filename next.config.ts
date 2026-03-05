import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: '**.myshopify.com',
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses all Sentry build logs during next build
  silent: !process.env.CI,

  // Routes browser error reports through your app to avoid ad blockers
  tunnelRoute: "/monitoring",

  // Source map upload (requires SENTRY_AUTH_TOKEN — add later for better stack traces)
  // org: "your-sentry-org",
  // project: "custom-ops",
  // authToken: process.env.SENTRY_AUTH_TOKEN,
});
