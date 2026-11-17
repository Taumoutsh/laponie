/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pas d'ESLint dans ce projet : le typage strict de TypeScript fait foi au build.
  eslint: { ignoreDuringBuilds: true },
  // exceljs et Prisma restent des dépendances Node côté serveur.
  serverExternalPackages: ['exceljs', '@prisma/client'],
};

export default nextConfig;
