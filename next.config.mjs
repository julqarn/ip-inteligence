/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Allow constrained CI/VM environments to opt out of the webpack build
    // worker (NEXT_WEBPACK_BUILD_WORKER=false). Defaults to Next.js behavior.
    webpackBuildWorker: process.env.NEXT_WEBPACK_BUILD_WORKER !== "false",
    ...(process.env.NEXT_BUILD_CPUS
      ? { cpus: Number(process.env.NEXT_BUILD_CPUS) }
      : {}),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
