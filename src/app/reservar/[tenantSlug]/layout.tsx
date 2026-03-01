import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reservar Mesa',
  description: 'Reserva una mesa en nuestro restaurante de manera rapida y sencilla.',
  openGraph: {
    title: 'Reservar Mesa',
    description: 'Reserva una mesa en nuestro restaurante',
    type: 'website',
    locale: 'es_PE',
  },
};

export default function ReservarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
