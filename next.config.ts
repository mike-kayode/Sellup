import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Type checking runs separately via `npm run typecheck`.
  // The TS worker can hang on this shared host (fork/thread pressure),
  // so builds skip it - CI/local typecheck remains the source of truth.
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // This shared host intermittently refuses process forks (EAGAIN) —
    // the LVE pids cgroup caps us at 50 processes+threads total,
    // so build with a single page-generation worker.
    cpus: 1,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;