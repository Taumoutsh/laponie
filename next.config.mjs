/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pas d'ESLint dans ce projet : le typage strict de TypeScript fait foi au build.
  eslint: { ignoreDuringBuilds: true },
  // exceljs et Prisma restent des dépendances Node côté serveur.
  serverExternalPackages: ['exceljs', '@prisma/client'],
  // L'app n'utilise pas next/image : on désactive l'optimiseur d'images (moins de surface d'attaque).
  images: { unoptimized: true },
};

export default nextConfig;
