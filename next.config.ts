import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  serverExternalPackages: ['@react-pdf/renderer', '@react-pdf/pdfkit', 'fontkit'],
};

export default nextConfig;
