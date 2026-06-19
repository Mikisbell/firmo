'use client';

/**
 * Dev Launcher — hub de navegacion para desarrollo.
 *
 * Lista todas las pantallas/estaciones del sistema para saltar a cualquiera sin
 * re-login. Cada tarjeta setea el ROL correcto de esa estacion en localStorage('dev_role')
 * y navega: el bypass de AuthProvider lo lee y monta la sesion con ese rol (probar cocina
 * como COOK, admin como OWNER, etc.) — el "Switch User" de los POS profesionales, para dev.
 *
 * Es la semilla del DISPATCHER de produccion: en prod, la entrada deberia enrutar por el
 * terminal_role (terminal_devices.role / terminals.station_id), no por estas URLs.
 *
 * SOLO desarrollo: en produccion muestra un aviso.
 *
 * @module app/dev/page
 */

interface Estacion {
  label: string;
  ruta: string;
  /** Rol del empleado a simular (employees.role) — el bypass lo aplica via dev_role. */
  rol: string;
  desc: string;
}

const GRUPOS: { titulo: string; items: Estacion[] }[] = [
  {
    titulo: 'Estaciones de operación',
    items: [
      { label: 'Caja (POS)', ruta: '/pos', rol: 'CASHIER', desc: 'Registro de ventas y cobro' },
      { label: 'Mozo', ruta: '/mozo', rol: 'WAITER', desc: 'Mesas y comandas' },
      { label: 'Cocina · Horno', ruta: '/cocina/horno', rol: 'COOK', desc: 'KDS — estación horno' },
      { label: 'Cocina · Empaque', ruta: '/cocina/empaque', rol: 'PACKER', desc: 'KDS — empaque / despacho' },
      { label: 'Bar', ruta: '/bar', rol: 'BAR', desc: 'KDS — barra' },
      { label: 'Display / KDS', ruta: '/display', rol: 'CASHIER', desc: 'Pantalla de pedidos (solo lectura)' },
    ],
  },
  {
    titulo: 'Delivery',
    items: [
      { label: 'Driver (repartidor)', ruta: '/driver', rol: 'DRIVER', desc: 'App del repartidor' },
      { label: 'Delivery (despacho)', ruta: '/delivery', rol: 'DRIVER', desc: 'Gestión de entregas' },
    ],
  },
  {
    titulo: 'Otros',
    items: [
      { label: 'Inventario', ruta: '/inventario', rol: 'MANAGER', desc: 'Stock y mermas (PIN)' },
      { label: 'Portal Empleado', ruta: '/employee', rol: 'CASHIER', desc: 'Autoservicio del empleado' },
    ],
  },
  {
    titulo: 'Back-office',
    items: [
      { label: 'Admin (panel)', ruta: '/admin', rol: 'OWNER', desc: 'Reportes, menú, staff, configuración' },
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

  const ir = (item: Estacion) => {
    try {
      localStorage.setItem('dev_role', item.rol);
    } catch {
      /* localStorage no disponible */
    }
    // Recarga completa para que AuthProvider re-inicialice la sesion con el nuevo rol.
    window.location.href = item.ruta;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">
            PARK POS <span className="text-indigo-400">· Dev Launcher</span>
          </h1>
          <p className="text-zinc-400 mt-2 font-medium">
            Salta a cualquier estación como su rol, sin re-login. En producción, la entrada
            enrutará por el <span className="text-zinc-300">terminal_role</span> (no estas URLs).
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
                  <button
                    key={item.ruta}
                    type="button"
                    onClick={() => ir(item)}
                    className="group text-left bg-zinc-900/60 hover:bg-zinc-800/80 border border-white/5 hover:border-indigo-500/40 rounded-2xl p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{item.label}</span>
                      <span className="text-[10px] font-mono text-zinc-500 group-hover:text-indigo-300">
                        {item.rol}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400 mt-1">{item.desc}</p>
                    <p className="text-xs font-mono text-zinc-600 mt-2">{item.ruta}</p>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-10 text-xs text-zinc-600 border-t border-white/5 pt-4">
          Cada estación se abre con su rol (dev_role) vía el bypass de AuthProvider + RoleGuard
          sin bloqueo en desarrollo. Modelo de producción en Engram: arquitectura de estaciones
          (Toast/Square/Lightspeed).
        </footer>
      </div>
    </div>
  );
}
