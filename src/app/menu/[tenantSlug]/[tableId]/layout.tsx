/**
 * Public Menu Layout - Customer-facing (light theme, no admin chrome)
 *
 * Minimal layout with mobile meta tags for restaurant QR menu.
 *
 * @module app/menu/[tenantSlug]/[tableId]/layout
 */

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Menú Digital',
  description: 'Menú del restaurante - Escanea el QR de tu mesa',
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
