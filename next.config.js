/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Optimise local PNG/JPG assets via Next.js Image Optimisation
    formats: ["image/avif", "image/webp"],
    // hero.png and signin.png are large — allow up to 4MB
    dangerouslyAllowSVG: false,
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
};
module.exports = nextConfig;
