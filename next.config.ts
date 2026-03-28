import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse v2는 pdfjs-dist worker를 동적으로 로드하므로
  // Next.js(Turbopack)가 직접 번들링하지 않고 Node.js 네이티브로 실행하도록 설정
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
