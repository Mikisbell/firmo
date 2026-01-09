// /caja route - Redirects to main POS
import { redirect } from 'next/navigation';

export default function CajaRedirect() {
    redirect('/pos');
}
