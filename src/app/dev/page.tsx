/**
 * Dev Launcher — hub de navegacion para desarrollo.
 *
 * Lista todas las pantallas/estaciones del sistema para saltar a cualquiera sin
 * re-login (el bypass de AuthProvider + el gate dev de RoleGuard hacen el resto).
 * Es la semilla del DISPATCHER de produccion: en prod, la entrada deberia enrutar
 * por el terminal_role (terminal_devices.role / terminals.station_id) en vez de URLs
 * hardcodeadas. Aqui, en dev, se listan todas para testear.
 *
 * SOLO desarrollo: en produccion muestra un aviso (no es un menu para usuarios reales).
 *
 * @module app/dev/page
 */
import Link from 'next/link';

interface Estacion {
  label: string;
  ruta: string;
  /** Tipo de estacion / rol al que mapea (alineado a terminal_devices.role / employees.role). */
  tipo: string;
  desc: string;
}

const GRUPOS: { titulo: string; items: Estacion[] }[] = [
  {
    titulo: 'Estaciones de operación',
    items: [
      { label: 'Caja (POS)', ruta: '/pos', tipo: 'CAJA / CASHIER', desc: 'Registro de ventas y cobro' },
      { label: 'Mozo', ruta: '/mozo', tipo: 'WAITER', desc: 'Mesas y comandas' },
      { label: 'Cocina · Horno', ruta: '/cocina/horno', tipo: 'COCINA / COOK', desc: 'KDS — estación horno' },
      { label: 'Cocina · Empaque', ruta: '/cocina/empaque', tipo: 'PACKER', desc: 'KDS — empaque / despacho' },
      { label: 'Bar', ruta: '/bar', tipo: 'BAR', desc: 'KDS — barra' },
      { label: 'Display / KDS', ruta: '/display', tipo: 'DISPLAY', desc: 'Pantalla de pedidos (solo lectura)' },
    ],
  },
  {
    titulo: 'Delivery',
    items: [
      { label: 'Driver (repartidor)', ruta: '/driver', tipo: 'DRIVER', desc: 'App del repartidor' },
      { label: 'Delivery (despacho)', ruta: '/delivery', tipo: 'DRIVER', desc: 'Gestión de entregas' },
    ],
  },
  {
    titulo: 'Otros',
    items: [
      { label: 'Inventario', ruta: '/inventario', tipo: 'ADMIN / MANAGER', desc: 'Stock y mermas (PIN)' },
      { label: 'Portal Empleado', ruta: '/employee', tipo: 'EMPLOYEE', desc: 'Autoservicio del empleado' },
    ],
  },
  {
    titulo: 'Back-office',
    items: [
      { label: 'Admin (panel)', ruta: '/admin', tipo: 'ADMIN_ROLES', desc: 'Reportes, menú, staff, configuración' },
    ],
  },
];

export default function DevLauncher() {
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-zinc-900/60 p-8 rounded-3xl border border-white/5">
          <h1 className="text-xl font-black text-white mb-2">Launcher de desarrollo</h1>
          <p className="text-zinc-400">Esta pantalla solo está disponible en modo desarrollo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">
            PARK POS <span className="text-indigo-400">· Dev Launcher</span>
          </h1>
          <p className="text-zinc-400 mt-2 font-medium">
            Salta a cualquier estación sin re-login. En producción, la entrada enrutará por el
            <span className="text-zinc-300"> terminal_role</span> (no estas URLs).
          </p>
        </header>

        <div className="space-y-8">
          {GRUPOS.map((grupo) => (
            <section key={grupo.titulo}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">
                {grupo.titulo}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grupo.items.map((item) => (
                  <Link
                    key={item.ruta}
                    href={item.ruta}
                    className="group block bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 hover:border-indigo-500/40 rounded-2xl p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{item.label}</span>
                      <span className="text-[10px] font-mono text-zinc-500 group-hover:text-indigo-300">
                        {item.tipo}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">{item.desc}</p>
                    <p className="text-xs font-mono text-zinc-600 mt-2">{item.ruta}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-10 text-xs text-zinc-600 border-t border-white/5 pt-4">
          Sesión dev: bypass de AuthProvider (CASHIER) + RoleGuard sin bloqueo en desarrollo.
          Para el modelo de producción ver Engram: arquitectura de estaciones (Toast/Square/Lightspeed).
        </footer>
      </div>
    </div>
  );
}
