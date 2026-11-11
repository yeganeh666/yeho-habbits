/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Required by the Dockerfile, which copies .next/standalone
  output: "standalone",
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};
export default nextConfig;
