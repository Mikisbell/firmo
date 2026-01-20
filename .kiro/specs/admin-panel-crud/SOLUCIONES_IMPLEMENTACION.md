# 🛠️ Soluciones de Implementación - Admin Panel

**Fecha**: 19 Enero 2026  
**Documento**: Guía práctica de implementación de mejoras

---

## 🚀 QUICK WINS (Implementación Inmediata)

### 1. Toast Notifications System

**Instalación**:
```bash
npm install sonner
```

**Implementación**:
```typescript
// src/app/admin/layout.tsx
import { Toaster } from 'sonner';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster 
        position="top-right"
        theme="dark"
        richColors
        closeButton
      />
    </>
  );
}
```

**Uso en componentes**:
```typescript
import { toast } from 'sonner';

// Success
const handleSave = async () => {
  try {
    await fetch(...);
    toast.success('Registro guardado exitosamente', {
      description: 'Los cambios se han aplicado correctamente',
    });
  } catch (err) {
    toast.error('Error al guardar', {
      description: err.message,
    });
  }
};

// Loading
const handleDelete = async (id: string) => {
  const promise = fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
  
  toast.promise(promise, {
    loading: 'Eliminando...',
    success: 'Producto eliminado',
    error: 'Error al eliminar',
  });
};
```

---

### 2. Hook Reutilizable para Fetch

**Crear archivo**: `src/hooks/useAdminData.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';

interface UseAdminDataOptions {
  autoFetch?: boolean;
  onSuccess?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function useAdminData<T>(
  endpoint: string,
  options: UseAdminDataOptions = {}
) {
  const { autoFetch = true, onSuccess, onError } = options;
  
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(endpoint);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch');
      }
      
      const result = await res.json();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar datos';
      setError(errorMessage);
      onError?.(err as Error);
    } finally {
      setLoading(false);
    }
  }, [endpoint, onSuccess, onError]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchData,
    setData, // Para actualizaciones optimistas
  };
}

// Hook para mutaciones (POST, PUT, DELETE)
export function useAdminMutation<T = unknown>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST'
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (data?: T) => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(endpoint, {
        method,
        headers: data ? { 'Content-Type': 'application/json' } : undefined,
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Operation failed');
      }

      return method === 'DELETE' ? null : await res.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error en la operación';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [endpoint, method]);

  return { mutate, loading, error };
}
```

**Uso**:
```typescript
// En lugar de esto:
const [employees, setEmployees] = useState<Employee[]>([]);
const [loading, setLoading] = useState(true);
const fetchEmployees = useCallback(async () => {...}, []);

// Usar esto:
const { data: employees, loading, error, refetch } = useAdminData<Employee>(
  '/api/admin/employees'
);

// Para mutaciones:
const { mutate: createEmployee, loading: creating } = useAdminMutation<Employee>(
  '/api/admin/employees',
  'POST'
);

const handleCreate = async (formData: Employee) => {
  try {
    await createEmployee(formData);
    toast.success('Empleado creado');
    refetch();
  } catch (err) {
    toast.error('Error al crear empleado');
  }
};
```

---

### 3. Componente Button Estandarizado

**Crear archivo**: `src/components/ui/Button.tsx`

```typescript
import { forwardRef, ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    loading = false,
    icon,
    children, 
    className = '',
    disabled,
    ...props 
  }, ref) => {
    const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variantClasses = {
      primary: 'bg-amber-500 hover:bg-amber-600 text-black',
      secondary: 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700',
      danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20',
      ghost: 'hover:bg-zinc-800 text-zinc-400 hover:text-white',
    };
    
    const sizeClasses = {
      sm: 'px-3 py-2 text-sm min-h-[36px]',
      md: 'px-4 py-2.5 text-sm min-h-[44px]',
      lg: 'px-6 py-3 text-base min-h-[48px]',
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**Uso**:
```typescript
import { Button } from '@/components/ui/Button';
import { Plus, Save, Trash2 } from 'lucide-react';

// Primary button
<Button variant="primary" icon={<Plus />} onClick={handleCreate}>
  Nuevo Registro
</Button>

// Loading state
<Button variant="primary" loading={saving} onClick={handleSave}>
  Guardar
</Button>

// Danger button
<Button variant="danger" icon={<Trash2 />} onClick={handleDelete}>
  Eliminar
</Button>

// Secondary button
<Button variant="secondary" onClick={onCancel}>
  Cancelar
</Button>
```

---

### 4. Error Boundary

**Crear archivo**: `src/components/ErrorBoundary.tsx`

```typescript
'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Aquí puedes enviar a Sentry
    // Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Algo salió mal</h2>
            <p className="text-zinc-400 mb-4">
              Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
            </p>
            {this.state.error && (
              <details className="text-left mb-4">
                <summary className="text-sm text-zinc-500 cursor-pointer">
                  Detalles técnicos
                </summary>
                <pre className="mt-2 p-3 bg-zinc-950 rounded text-xs text-red-400 overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

**Uso**:
```typescript
// src/app/admin/layout.tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-zinc-950">
        {children}
      </div>
    </ErrorBoundary>
  );
}
```

---

### 5. Input Component Estandarizado

**Crear archivo**: `src/components/ui/Input.tsx`

```typescript
import { forwardRef, InputHTMLAttributes } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className = '', ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-zinc-300">
            {label}
            {props.required && <span className="text-red-400 ml-1">*</span>}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
              {icon}
            </div>
          )}
          
          <input
            ref={ref}
            className={`
              w-full px-3 py-2.5 min-h-[44px]
              bg-zinc-800 border rounded-lg
              text-white placeholder:text-zinc-500
              focus:outline-none focus:ring-2 focus:ring-amber-500/50
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? 'border-red-500/50' : 'border-zinc-700'}
              ${icon ? 'pl-10' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        
        {error && (
          <div className="flex items-center gap-1 text-red-400 text-sm">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
        
        {helperText && !error && (
          <p className="text-xs text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

**Uso**:
```typescript
import { Input } from '@/components/ui/Input';
import { User, Mail, Lock } from 'lucide-react';

<Input
  label="Nombre"
  icon={<User className="w-4 h-4" />}
  value={form.name}
  onChange={(e) => setForm({ ...form, name: e.target.value })}
  error={errors.name}
  required
/>

<Input
  label="Email"
  type="email"
  icon={<Mail className="w-4 h-4" />}
  value={form.email}
  onChange={(e) => setForm({ ...form, email: e.target.value })}
  helperText="Usaremos este email para notificaciones"
/>
```

---

## 📱 RESPONSIVE IMPROVEMENTS

### 6. Mobile Card View para DataTable

**Actualizar**: `src/app/admin/components/DataTable.tsx`

```typescript
// Agregar después de la tabla existente
{/* Mobile Card View */}
<div className="md:hidden space-y-3">
  {paginatedData.map((item) => (
    <div
      key={item.id}
      onClick={() => onRowClick?.(item)}
      className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 space-y-3"
    >
      {columns.map((col) => {
        if (col.key === 'actions') return null; // Skip actions column
        
        return (
          <div key={String(col.key)} className="flex justify-between items-start">
            <span className="text-sm text-zinc-400">{col.label}</span>
            <span className="text-sm font-medium text-right">
              {col.render
                ? col.render(item)
                : String((item as Record<string, unknown>)[col.key as string] ?? '')}
            </span>
          </div>
        );
      })}
      
      {/* Actions at bottom */}
      {columns.find(c => c.key === 'actions') && (
        <div className="pt-3 border-t border-zinc-800">
          {columns.find(c => c.key === 'actions')?.render?.(item)}
        </div>
      )}
    </div>
  ))}
</div>
```

---

### 7. Bottom Sheet para Modales en Móvil

**Crear archivo**: `src/components/ui/BottomSheet.tsx`

```typescript
'use client';

import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-zinc-900 rounded-t-2xl border-t border-zinc-800 max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-12 h-1 bg-zinc-700 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Uso**:
```typescript
// Usar BottomSheet en móvil, Modal en desktop
const isMobile = useMediaQuery('(max-width: 768px)');

{isMobile ? (
  <BottomSheet isOpen={showForm} onClose={onClose} title="Nuevo Empleado">
    <EmployeeForm />
  </BottomSheet>
) : (
  <Modal isOpen={showForm} onClose={onClose} title="Nuevo Empleado">
    <EmployeeForm />
  </Modal>
)}
```

---

## 🔐 SECURITY IMPROVEMENTS

### 8. Migrar a httpOnly Cookies

**Backend** (`src/app/api/auth/login/route.ts`):
```typescript
import { cookies } from 'next/headers';
import { SignJWT } from 'jose';

export async function POST(request: NextRequest) {
  // ... validación de PIN ...
  
  // Crear JWT
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);
  const token = await new SignJWT({ 
    employeeId: employee.id,
    role: employee.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30m')
    .sign(secret);
  
  // Set httpOnly cookie
  cookies().set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 30 * 60, // 30 minutes
    path: '/',
  });
  
  return NextResponse.json({ success: true, employee });
}
```

**Middleware** (`src/middleware.ts`):
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  // Check if route requires auth
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const token = request.cookies.get('session')?.value;
    
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET);
      const { payload } = await jwtVerify(token, secret);
      
      // Add user info to headers for API routes
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', payload.employeeId as string);
      requestHeaders.set('x-user-role', payload.role as string);
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (err) {
      // Invalid token
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
```

---

## 📊 MONITORING & ANALYTICS

### 9. Error Tracking con Sentry

**Instalación**:
```bash
npm install @sentry/nextjs
```

**Configuración** (`sentry.client.config.ts`):
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

**Uso**:
```typescript
try {
  await dangerousOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      section: 'admin-panel',
      action: 'create-employee',
    },
    extra: {
      employeeData: formData,
    },
  });
  toast.error('Error al crear empleado');
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### Fase 1: Crítico (1 semana)
- [ ] Instalar y configurar Sonner (toast notifications)
- [ ] Crear hook useAdminData
- [ ] Crear hook useAdminMutation
- [ ] Implementar Error Boundary
- [ ] Migrar a httpOnly cookies
- [ ] Configurar Sentry

### Fase 2: Importante (2 semanas)
- [ ] Crear componente Button estandarizado
- [ ] Crear componente Input estandarizado
- [ ] Actualizar todas las páginas para usar hooks
- [ ] Agregar aria-labels a todos los botones
- [ ] Mejorar contraste de colores (zinc-500 → zinc-400)
- [ ] Implementar navegación por teclado en DataTable

### Fase 3: Mejoras (3 semanas)
- [ ] Implementar vista de cards para móvil
- [ ] Crear componente BottomSheet
- [ ] Agregar React.memo a componentes pesados
- [ ] Implementar code splitting
- [ ] Configurar Storybook
- [ ] Escribir tests de accesibilidad

---

**¿Quieres que implemente alguna de estas soluciones ahora?**
