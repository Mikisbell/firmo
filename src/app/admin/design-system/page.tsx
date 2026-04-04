'use client';

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

      {/* ── 7. Tokens de Color ── */}
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
