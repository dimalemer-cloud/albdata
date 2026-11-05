/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["imapflow", "nodemailer", "mailparser", "@prisma/client"],
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
