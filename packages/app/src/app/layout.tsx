import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CollaFlow',
  description: 'High-performance collaborative mind map & document workspace',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
