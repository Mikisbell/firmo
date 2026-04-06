'use client';

/**
 * Unified Team Management Page
 * Replaces: /admin/empleados, /admin/drivers, /admin/hr, /admin/ranking-meseros
 * Inspired by 7shifts team management model
 *
 * Requirements: 4.1, 4.2, 9.6
 */

import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserPlus,
  Shield,
  Coffee,
  ChefHat,
  Receipt,
  Truck,
  Wine,
  UserX,
  MoreVertical,
  Eye,
  Edit2,
  UserMinus,
  Search,
} from 'lucide-react';
import {
  Button,
  Badge,
  Card,
  PageHeader,
  Avatar,
  EmptyState,
  Tabs,
  Input,
  Dropdown,
  SkeletonTable,
} from '@/src/components/ui';
import { useAdminData } from '@/src/hooks/useAdminData';
import { useQueryState } from '@/src/hooks/useQueryState';
import { ROLE_LABELS } from '@/src/core/constants/roles';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  phone: string | null;
  email: string | null;
  profile_photo_url: string | null;
  hire_date: string | null;
  drivers: Array<{
    id: string;
    name: string;
    is_active: boolean;
  }>;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_BADGE_VARIANT: Record<string, 'success' | 'warning' | 'critical' | 'info' | 'neutral'> = {
  OWNER:      'critical',
  ADMIN:      'critical',
  MANAGER:    'warning',
  SUPERVISOR: 'warning',
  CASHIER:    'info',
  WAITER:     'success',
  KITCHEN:    'neutral',
  COOK:       'neutral',
  PACKER:     'neutral',
  BAR:        'neutral',
  DRIVER:     'info',
};

const ROLE_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'WAITER', label: 'Mozos', icon: <Coffee size={14} /> },
  { value: 'KITCHEN,COOK,PACKER', label: 'Cocina', icon: <ChefHat size={14} /> },
  { value: 'CASHIER', label: 'Caja', icon: <Receipt size={14} /> },
  { value: 'DRIVER', label: 'Delivery', icon: <Truck size={14} /> },
  { value: 'BAR', label: 'Bar', icon: <Wine size={14} /> },
  { value: 'ADMIN,MANAGER,SUPERVISOR,OWNER', label: 'Admin', icon: <Shield size={14} /> },
  { value: 'inactive', label: 'Inactivos', icon: <UserX size={14} /> },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function TeamPage() {
  const router = useRouter();
  const [roleFilter, setRoleFilter] = useQueryState<string>('role', 'all');
  const [search, setSearch] = useQueryState<string>('q', '');

  // Fetch all employees (active + inactive) with driver relations
  const { data: allMembers, loading, error } = useAdminData<TeamMember>(
    '/api/admin/team?pageSize=200',
  );

  // ─── Filtering logic ────────────────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    if (!allMembers) return [];

    let filtered = allMembers;

    // Role filter
    if (roleFilter === 'inactive') {
      filtered = filtered.filter((m) => !m.is_active);
    } else if (roleFilter !== 'all') {
      const roles = roleFilter.split(',');
      filtered = filtered.filter((m) => m.is_active && roles.includes(m.role));
    } else {
      filtered = filtered.filter((m) => m.is_active);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.phone?.toLowerCase().includes(q) ||
          m.email?.toLowerCase().includes(q),
      );
    }

    return filtered;
  }, [allMembers, roleFilter, search]);

  // ─── Counts for tab badges ──────────────────────────────────────────────────

  const tabCounts = useMemo(() => {
    if (!allMembers) return {} as Record<string, number>;
    const counts: Record<string, number> = {};

    const active = allMembers.filter((m) => m.is_active);
    counts['all'] = active.length;
    counts['inactive'] = allMembers.filter((m) => !m.is_active).length;

    for (const tab of ROLE_TABS) {
      if (tab.value === 'all' || tab.value === 'inactive') continue;
      const roles = tab.value.split(',');
      counts[tab.value] = active.filter((m) => roles.includes(m.role)).length;
    }

    return counts;
  }, [allMembers]);

  const totalEmployees = allMembers?.filter((m) => m.is_active).length ?? 0;

  // Tab items with badges
  const tabItems = ROLE_TABS.map((tab) => ({
    ...tab,
    badge:
      tabCounts[tab.value] !== undefined ? (
        <Badge variant="neutral" size="sm">
          {tabCounts[tab.value]}
        </Badge>
      ) : undefined,
  }));

  // ─── Actions dropdown ───────────────────────────────────────────────────────

  const getActions = useCallback(
    (member: TeamMember) => [
      {
        label: 'Ver perfil',
        icon: <Eye size={14} />,
        onClick: () => router.push(`/admin/equipo/${member.id}`),
      },
      {
        label: 'Editar',
        icon: <Edit2 size={14} />,
        onClick: () => router.push(`/admin/empleados/${member.id}`),
      },
      { separator: true, label: '' },
      {
        label: member.is_active ? 'Desactivar' : 'Activar',
        icon: <UserMinus size={14} />,
        variant: member.is_active ? ('destructive' as const) : ('default' as const),
        onClick: () => {
          // Redirect to edit page where toggle exists
          router.push(`/admin/empleados/${member.id}`);
        },
      },
    ],
    [router],
  );

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Equipo"
          description="Cargando..."
        />
        <Card padding="none">
          <SkeletonTable rows={8} columns={6} />
        </Card>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Equipo"
        description={`${totalEmployees} miembros del equipo`}
        actions={
          <Button
            variant="primary"
            icon={<UserPlus size={16} />}
            onClick={() => router.push('/admin/empleados/nuevo')}
          >
            Nuevo Miembro
          </Button>
        }
      />

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Role filter tabs */}
      <Tabs value={roleFilter} onChange={setRoleFilter} tabs={tabItems} />

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre, telefono o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
        />
      </div>

      {/* Table */}
      <Card padding="none">
        {filteredMembers.length === 0 ? (
          <EmptyState
            icon={<UserPlus />}
            title="Sin miembros en el equipo"
            description={
              roleFilter === 'all'
                ? 'Agrega tu primer empleado para empezar'
                : 'No hay miembros con este filtro'
            }
            action={
              roleFilter === 'all'
                ? {
                    label: 'Nuevo Miembro',
                    onClick: () => router.push('/admin/empleados/nuevo'),
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-park-gray-800 bg-park-gray-900/50">
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">
                    Telefono
                  </th>
                  <th className="px-4 py-3 text-left text-park-gray-400 font-medium">
                    Delivery
                  </th>
                  <th className="px-4 py-3 text-right text-park-gray-400 font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const hasDriver = member.drivers && member.drivers.length > 0;
                  return (
                    <tr
                      key={member.id}
                      onClick={() => router.push(`/admin/equipo/${member.id}`)}
                      className={`
                        border-b border-park-gray-800/50 hover:bg-park-gray-800/30
                        transition-colors cursor-pointer
                        ${!member.is_active ? 'opacity-60' : ''}
                      `}
                    >
                      {/* Avatar + Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={member.profile_photo_url || undefined}
                            name={member.name}
                            size="sm"
                            status={member.is_active ? 'online' : 'offline'}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">
                              {member.name}
                            </div>
                            {member.email && (
                              <div className="text-xs text-park-gray-500 truncate">
                                {member.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_BADGE_VARIANT[member.role] || 'neutral'}>
                          <span className="inline-flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            {ROLE_LABELS[member.role] || member.role}
                          </span>
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge variant={member.is_active ? 'success' : 'neutral'} dot>
                          {member.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 text-park-gray-400">
                        {member.phone || '-'}
                      </td>

                      {/* Driver badge */}
                      <td className="px-4 py-3">
                        {hasDriver ? (
                          <Badge variant="info" size="sm">
                            Motorizado
                          </Badge>
                        ) : (
                          <span className="text-park-gray-600">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex justify-end"
                        >
                          <Dropdown
                            trigger={
                              <Button variant="ghost" size="sm" icon={<MoreVertical size={16} />} />
                            }
                            items={getActions(member)}
                            align="end"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
