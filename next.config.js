/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== "production";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${isDevelopment && process.env.LATIN_QUEST_LOCAL_QA === "1" ? " http://127.0.0.1:55321 ws://127.0.0.1:55321" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  distDir: isDevelopment && process.env.LATIN_QUEST_LOCAL_QA === "1" ? ".next-qa" : ".next",
  reactStrictMode: true,
  poweredByHeader: false,
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
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
