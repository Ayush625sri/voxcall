import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { CallProvider } from '@/lib/call-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VoxCall - Voice & Video Calls',
  description: 'WebRTC-based calling app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <CallProvider>
            {children}
          </CallProvider>
        </AuthProvider>
      </body>
    </html>
  );
}