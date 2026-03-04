import { redirect } from 'next/navigation';

/**
 * /caja → /pos redirect.
 * The legacy /caja prototype was removed. The production POS is at /pos.
 */
export default function CajaRedirect() {
  redirect('/pos');
}
