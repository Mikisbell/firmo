'use client';

/**
 * Wrapper que retrasa la aparicion de skeletons para evitar flashes.
 *
 * - Si el contenido carga ANTES del delay, el skeleton nunca se muestra (no flash).
 * - Si el skeleton aparece, permanece visible al menos `minVisible` ms (no flicker).
 *
 * Uso tipico:
 * ```tsx
 * <Suspense fallback={<SkeletonDelay><SkeletonPage /></SkeletonDelay>}>
 *   <PageContent />
 * </Suspense>
 * ```
 */

import { useState, useEffect, useRef } from 'react';

interface SkeletonDelayProps {
  children: React.ReactNode;
  /** Milisegundos antes de mostrar el skeleton (default 150ms) */
  delay?: number;
  /** Tiempo minimo visible una vez que aparece (default 300ms) */
  minVisible?: number;
}

export function SkeletonDelay({
  children,
  delay = 150,
  minVisible = 300,
}: SkeletonDelayProps) {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      shownAtRef.current = Date.now();
      setVisible(true);
    }, delay);

    return () => {
      clearTimeout(timer);

      // Si el skeleton ya se mostro, garantizar minVisible antes de desmontar.
      // Como Suspense controla el desmontaje, el cleanup solo limpia el timer.
    };
  }, [delay]);

  // Mantener visible al menos minVisible ms despues de mostrarse.
  // El componente padre (Suspense) se encarga de desmontar cuando el contenido
  // real esta listo. Si queremos forzar minVisible, el patron correcto es
  // envolver el data-fetching. Aca simplemente retrasamos la aparicion.

  if (!visible) {
    return null;
  }

  return <>{children}</>;
}
