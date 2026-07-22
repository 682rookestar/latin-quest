/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  images: {
    // Keep the optional native image processor out of the request path. Re-enable
    // optimisation once Next.js ships with a patched compatible Sharp release.
    unoptimized: true,
    formats: ["image/avif", "image/webp"],
    // hero.png and signin.png are large — allow up to 4MB
    dangerouslyAllowSVG: false,
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
};
module.exports = nextConfig;
