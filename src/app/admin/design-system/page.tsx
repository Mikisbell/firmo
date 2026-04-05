'use client';

import { useState } from 'react';
import {
  Button,
  Badge,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  PageHeader,
  MetricCard,
  EmptyState,
  Input,
  Select,
  Textarea,
  Checkbox,
  Switch,
  FormField,
  Modal,
  DetailDrawer,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonMetricCard,
  SkeletonPageHeader,
} from '@/src/components/ui';
import {
  Plus,
  ArrowRight,
  DollarSign,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Package,
  Search,
  Mail,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

/* ─── Section wrapper ─── */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </CardHeader>
      <CardContent className="pt-5 space-y-6">{children}</CardContent>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-park-gray-400">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

/* ─── Color swatch ─── */
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-10 h-10 rounded-lg border border-park-gray-700 ${color}`} />
      <span className="text-[10px] text-park-gray-500 font-mono">{label}</span>
    </div>
  );
}

export default function DesignSystemPage() {
  const notify = (msg: string) => () => toast.success(msg);

  // Modal/Drawer state
  const [modalSm, setModalSm] = useState(false);
  const [modalMd, setModalMd] = useState(false);
  const [modalLg, setModalLg] = useState(false);
  const [modalXl, setModalXl] = useState(false);
  const [modalFooter, setModalFooter] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Form demo state
  const [switchDemo, setSwitchDemo] = useState(true);
  const [switchDemo2, setSwitchDemo2] = useState(false);
  const [checkboxDemo, setCheckboxDemo] = useState(true);
  const [checkboxDemo2, setCheckboxDemo2] = useState(false);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        title="Sistema de Diseno"
        description="Catalogo de componentes UI — referencia visual para mantener consistencia"
      />

      {/* ── 1. Botones ── */}
      <Section title="Botones">
        <Row label="Variantes">
          <Button variant="primary" onClick={notify('Primary')}>
            Primary
          </Button>
          <Button variant="secondary" onClick={notify('Secondary')}>
            Secondary
          </Button>
          <Button variant="destructive" onClick={notify('Destructive')}>
            Destructive
          </Button>
          <Button variant="ghost" onClick={notify('Ghost')}>
            Ghost
          </Button>
        </Row>

        <Row label="Tamanos">
          <Button size="sm" onClick={notify('Small')}>
            Small
          </Button>
          <Button size="md" onClick={notify('Medium')}>
            Medium
          </Button>
          <Button size="lg" onClick={notify('Large')}>
            Large
          </Button>
        </Row>

        <Row label="Estados">
          <Button loading>Cargando</Button>
          <Button disabled>Deshabilitado</Button>
          <Button icon={<Plus className="h-4 w-4" />} onClick={notify('Con icono')}>
            Con icono
          </Button>
          <Button
            iconRight={<ArrowRight className="h-4 w-4" />}
            onClick={notify('Icono derecho')}
          >
            Icono derecho
          </Button>
        </Row>
      </Section>

      {/* ── 2. Badges ── */}
      <Section title="Badges">
        <Row label="Estados semanticos">
          <Badge variant="success">Activo</Badge>
          <Badge variant="warning">Pendiente</Badge>
          <Badge variant="critical">Fallido</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="neutral">Borrador</Badge>
        </Row>

        <Row label="Con indicador">
          <Badge variant="success" dot>Activo</Badge>
          <Badge variant="warning" dot>Pendiente</Badge>
          <Badge variant="critical" dot>Fallido</Badge>
          <Badge variant="info" dot>Info</Badge>
          <Badge variant="neutral" dot>Borrador</Badge>
        </Row>

        <Row label="Tamanos">
          <Badge variant="info" size="sm">Small</Badge>
          <Badge variant="info" size="md">Medium</Badge>
        </Row>
      </Section>

      {/* ── 3. Cards ── */}
      <Section title="Cards">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-park-gray-300">
              Card por defecto con padding <code className="text-park-brand-500">md</code>
            </p>
          </Card>

          <Card hover>
            <p className="text-sm text-park-gray-300">
              Card con <code className="text-park-brand-500">hover</code> — pasa el mouse
            </p>
          </Card>

          <Card padding="none">
            <CardHeader>
              <span className="text-sm font-medium text-white">CardHeader</span>
            </CardHeader>
            <CardContent className="p-6">
              <p className="text-sm text-park-gray-300">CardContent</p>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" size="sm" onClick={notify('Cancelar')}>
                Cancelar
              </Button>
              <Button size="sm" onClick={notify('Guardar')}>
                Guardar
              </Button>
            </CardFooter>
          </Card>
        </div>
      </Section>

      {/* ── 4. Metricas ── */}
      <Section title="Tarjetas de Metrica">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Ventas del dia"
            value={125000}
            format="currency"
            trend={{ value: 12.5, isPositive: true }}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <MetricCard
            label="Ordenes"
            value={47}
            format="number"
            trend={{ value: 5, isPositive: true }}
            icon={<ShoppingCart className="h-5 w-5" />}
          />
          <MetricCard
            label="Ticket promedio"
            value={2659}
            format="currency"
            trend={{ value: -3.2, isPositive: false }}
            icon={<Receipt className="h-5 w-5" />}
          />
          <MetricCard
            label="Margen bruto"
            value={68}
            format="percent"
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>
      </Section>

      {/* ── 5. Estado Vacio ── */}
      <Section title="Estados Vacios">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-dashed">
            <EmptyState
              icon={<Package />}
              title="Sin productos"
              description="Agrega productos para comenzar a vender"
              action={{
                label: 'Agregar producto',
                onClick: () => toast.success('Agregar producto clickeado'),
              }}
            />
          </Card>
          <Card className="border-dashed">
            <EmptyState
              icon={<Search />}
              title="Sin resultados"
              description="Intenta con otros filtros"
            />
          </Card>
        </div>
      </Section>

      {/* ── 6. PageHeader ── */}
      <Section title="Encabezado de Pagina">
        <div className="rounded-lg border border-park-gray-700 p-4">
          <PageHeader
            title="Ejemplo de Pagina"
            description="Subtitulo descriptivo"
            backHref="#"
            actions={
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={notify('Accion del header')}
              >
                Nueva accion
              </Button>
            }
            className="mb-0"
          />
        </div>
      </Section>

      {/* ── 7. Formularios ── */}
      <Section title="Formularios">
        <Row label="Input con label, hint e iconos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <Input
              label="Nombre"
              placeholder="Ej: Juan Perez"
              hint="Nombre completo del empleado"
            />
            <Input
              label="Correo electronico"
              type="email"
              placeholder="usuario@ejemplo.com"
              leftIcon={<Mail className="h-4 w-4" />}
            />
            <Input
              label="Usuario"
              placeholder="usuario"
              leftIcon={<User className="h-4 w-4" />}
              error="Este usuario ya existe"
            />
            <Input
              label="Busqueda"
              placeholder="Buscar..."
              rightIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </Row>

        <Row label="Select">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <Select
              label="Categoria"
              placeholder="Selecciona una categoria"
              options={[
                { value: 'POLLOS', label: 'Pollos' },
                { value: 'BEBIDAS', label: 'Bebidas' },
                { value: 'POSTRES', label: 'Postres' },
              ]}
            />
            <Select
              label="Rol"
              options={[
                { value: 'ADMIN', label: 'Administrador' },
                { value: 'CASHIER', label: 'Cajero' },
                { value: 'WAITER', label: 'Mesero' },
              ]}
              hint="Define los permisos del empleado"
            />
          </div>
        </Row>

        <Row label="Textarea">
          <div className="w-full">
            <Textarea
              label="Descripcion"
              placeholder="Describe el producto..."
              hint="Maximo 500 caracteres"
              rows={3}
            />
          </div>
        </Row>

        <Row label="Checkbox">
          <div className="flex flex-col gap-3 w-full">
            <Checkbox
              label="Producto activo"
              description="Visible en el catalogo POS"
              checked={checkboxDemo}
              onChange={(e) => setCheckboxDemo(e.target.checked)}
            />
            <Checkbox
              label="Aceptar terminos y condiciones"
              checked={checkboxDemo2}
              onChange={(e) => setCheckboxDemo2(e.target.checked)}
            />
            <Checkbox label="Deshabilitado" disabled checked={false} />
          </div>
        </Row>

        <Row label="Switch">
          <div className="flex flex-col gap-3 w-full">
            <Switch
              label="Notificaciones por email"
              description="Recibir alertas diarias"
              checked={switchDemo}
              onCheckedChange={setSwitchDemo}
            />
            <Switch
              label="Modo mantenimiento"
              description="Pausar nuevas ordenes"
              checked={switchDemo2}
              onCheckedChange={setSwitchDemo2}
            />
          </div>
        </Row>

        <Row label="FormField (wrapper generico)">
          <div className="w-full">
            <FormField label="Campo personalizado" required hint="Usa FormField cuando el control no es estandar">
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">Opcion A</Button>
                <Button variant="secondary" size="sm">Opcion B</Button>
                <Button variant="secondary" size="sm">Opcion C</Button>
              </div>
            </FormField>
          </div>
        </Row>
      </Section>

      {/* ── 8. Modal ── */}
      <Section title="Modal">
        <Row label="Tamanios (sm, md, lg, xl)">
          <Button variant="secondary" onClick={() => setModalSm(true)}>
            Abrir sm
          </Button>
          <Button variant="secondary" onClick={() => setModalMd(true)}>
            Abrir md
          </Button>
          <Button variant="secondary" onClick={() => setModalLg(true)}>
            Abrir lg
          </Button>
          <Button variant="secondary" onClick={() => setModalXl(true)}>
            Abrir xl
          </Button>
        </Row>

        <Row label="Con acciones en footer">
          <Button onClick={() => setModalFooter(true)}>
            Abrir modal con footer
          </Button>
        </Row>

        <Modal open={modalSm} onClose={() => setModalSm(false)} title="Modal pequeno" size="sm">
          <p className="text-sm text-park-gray-300">
            Este es un modal de tamanio <code>sm</code> (max-w-md). Ideal para confirmaciones rapidas.
          </p>
        </Modal>

        <Modal open={modalMd} onClose={() => setModalMd(false)} title="Modal mediano" description="Tamanio por defecto" size="md">
          <p className="text-sm text-park-gray-300">
            Este es un modal de tamanio <code>md</code> (max-w-lg). Util para formularios cortos.
          </p>
        </Modal>

        <Modal open={modalLg} onClose={() => setModalLg(false)} title="Modal grande" size="lg">
          <p className="text-sm text-park-gray-300">
            Este es un modal de tamanio <code>lg</code> (max-w-2xl). Ideal para formularios completos.
          </p>
        </Modal>

        <Modal open={modalXl} onClose={() => setModalXl(false)} title="Modal extra grande" size="xl">
          <p className="text-sm text-park-gray-300">
            Este es un modal de tamanio <code>xl</code> (max-w-4xl). Para tablas o contenido extenso.
          </p>
        </Modal>

        <Modal
          open={modalFooter}
          onClose={() => setModalFooter(false)}
          title="Confirmar accion"
          description="Esta accion no se puede deshacer"
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalFooter(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  toast.success('Accion confirmada');
                  setModalFooter(false);
                }}
              >
                Confirmar
              </Button>
            </>
          }
        >
          <p className="text-sm text-park-gray-300">
            Estas seguro que deseas eliminar este registro? Se eliminaran todos los datos asociados.
          </p>
        </Modal>
      </Section>

      {/* ── 9. Panel Lateral ── */}
      <Section title="Panel Lateral">
        <Row label="DetailDrawer (slide desde la derecha)">
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Abrir panel lateral
          </Button>
        </Row>

        <DetailDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Detalle del registro"
          description="Vista al estilo Stripe ContextView"
          width="md"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDrawerOpen(false)}>
                Cerrar
              </Button>
              <Button onClick={notify('Guardado')}>Guardar</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs text-park-gray-500 uppercase tracking-wide">Nombre</p>
              <p className="text-sm text-white mt-1">Pollo a la Brasa 1/4</p>
            </div>
            <div>
              <p className="text-xs text-park-gray-500 uppercase tracking-wide">SKU</p>
              <p className="text-sm text-white mt-1 font-mono">POLLO-1-4</p>
            </div>
            <div>
              <p className="text-xs text-park-gray-500 uppercase tracking-wide">Precio</p>
              <p className="text-sm text-white mt-1 tabular-nums">S/. 15.00</p>
            </div>
            <div>
              <p className="text-xs text-park-gray-500 uppercase tracking-wide">Estado</p>
              <Badge variant="success" dot>Activo</Badge>
            </div>
          </div>
        </DetailDrawer>
      </Section>

      {/* ── 10. Estados de Carga ── */}
      <Section title="Estados de Carga">
        <Row label="SkeletonText">
          <div className="w-full max-w-md">
            <SkeletonText />
          </div>
        </Row>

        <Row label="SkeletonCard">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </Row>

        <Row label="SkeletonTable">
          <div className="w-full">
            <SkeletonTable rows={4} />
          </div>
        </Row>

        <Row label="SkeletonMetricCard">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </div>
        </Row>

        <Row label="SkeletonPageHeader">
          <div className="w-full">
            <SkeletonPageHeader />
          </div>
        </Row>
      </Section>

      {/* ── 11. Tipografia ── */}
      <Section title="Tipografia">
        <Row label="Familia: Inter (variable font)">
          <div className="w-full">
            <p className="text-park-gray-400 text-xs font-mono mb-2">font-sans (Inter)</p>
            <p className="text-white">
              La rapida zorra marron salta sobre el perro perezoso. 0123456789
            </p>
          </div>
        </Row>

        <Row label="Escala de tamanios">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-park-gray-500 font-mono w-16">text-xs</span>
              <span className="text-xs text-white">Extra small (12px)</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-park-gray-500 font-mono w-16">text-sm</span>
              <span className="text-sm text-white">Small (14px)</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-park-gray-500 font-mono w-16">text-base</span>
              <span className="text-base text-white">Base (16px)</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-park-gray-500 font-mono w-16">text-lg</span>
              <span className="text-lg text-white">Large (18px)</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-park-gray-500 font-mono w-16">text-xl</span>
              <span className="text-xl text-white">Extra large (20px)</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-park-gray-500 font-mono w-16">text-2xl</span>
              <span className="text-2xl text-white">2XL (24px)</span>
            </div>
            <div className="flex items-baseline gap-4">
              <span className="text-xs text-park-gray-500 font-mono w-16">text-3xl</span>
              <span className="text-3xl text-white font-semibold">3XL (30px)</span>
            </div>
          </div>
        </Row>

        <Row label="Pesos">
          <div className="flex flex-col gap-1 w-full">
            <p className="text-white font-normal">font-normal (400) — Texto regular</p>
            <p className="text-white font-medium">font-medium (500) — Texto medio</p>
            <p className="text-white font-semibold">font-semibold (600) — Semi-bold</p>
            <p className="text-white font-bold">font-bold (700) — Bold</p>
          </div>
        </Row>

        <Row label="tabular-nums (alineacion de columnas numericas)">
          <div className="w-full max-w-md">
            <p className="text-xs text-park-gray-500 mb-2">
              Sin tabular-nums (numeros de ancho variable):
            </p>
            <div className="space-y-1 font-normal">
              <div className="flex justify-between">
                <span className="text-park-gray-300">Subtotal</span>
                <span className="text-white">S/. 1,234.56</span>
              </div>
              <div className="flex justify-between">
                <span className="text-park-gray-300">IGV</span>
                <span className="text-white">S/. 222.22</span>
              </div>
              <div className="flex justify-between">
                <span className="text-park-gray-300">Total</span>
                <span className="text-white">S/. 1,456.78</span>
              </div>
            </div>

            <p className="text-xs text-park-gray-500 mt-4 mb-2">
              Con tabular-nums (numeros alineados):
            </p>
            <div className="space-y-1 tabular-nums">
              <div className="flex justify-between">
                <span className="text-park-gray-300">Subtotal</span>
                <span className="text-white">S/. 1,234.56</span>
              </div>
              <div className="flex justify-between">
                <span className="text-park-gray-300">IGV</span>
                <span className="text-white">S/. 222.22</span>
              </div>
              <div className="flex justify-between">
                <span className="text-park-gray-300">Total</span>
                <span className="text-white">S/. 1,456.78</span>
              </div>
            </div>
          </div>
        </Row>
      </Section>

      {/* ── 12. Tokens de Color ── */}
      <Section title="Paleta de Colores">
        <Row label="Escala de grises">
          <Swatch color="bg-park-gray-50" label="gray-50" />
          <Swatch color="bg-park-gray-100" label="gray-100" />
          <Swatch color="bg-park-gray-200" label="gray-200" />
          <Swatch color="bg-park-gray-300" label="gray-300" />
          <Swatch color="bg-park-gray-400" label="gray-400" />
          <Swatch color="bg-park-gray-500" label="gray-500" />
          <Swatch color="bg-park-gray-600" label="gray-600" />
          <Swatch color="bg-park-gray-700" label="gray-700" />
          <Swatch color="bg-park-gray-800" label="gray-800" />
          <Swatch color="bg-park-gray-900" label="gray-900" />
          <Swatch color="bg-park-gray-950" label="gray-950" />
        </Row>

        <Row label="Semanticos">
          <Swatch color="bg-park-success" label="success" />
          <Swatch color="bg-park-success-subtle" label="success-subtle" />
          <Swatch color="bg-park-warning" label="warning" />
          <Swatch color="bg-park-warning-subtle" label="warning-subtle" />
          <Swatch color="bg-park-critical" label="critical" />
          <Swatch color="bg-park-critical-subtle" label="critical-subtle" />
          <Swatch color="bg-park-info" label="info" />
          <Swatch color="bg-park-info-subtle" label="info-subtle" />
        </Row>

        <Row label="Brand">
          <Swatch color="bg-park-brand-500" label="brand-500" />
          <Swatch color="bg-park-brand-600" label="brand-600" />
        </Row>
      </Section>
    </div>
  );
}
