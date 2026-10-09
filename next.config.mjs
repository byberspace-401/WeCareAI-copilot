/** @type {import('next').NextConfig} */
const appHost = process.env.NEXT_PUBLIC_API_URL
  ? new URL(process.env.NEXT_PUBLIC_API_URL).hostname
  : "localhost";

const nextConfig = {
  allowedDevOrigins: [appHost],
};

export default nextConfig;
