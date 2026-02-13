# Análisis Correcto: Error de Build en Vercel - 13 Febrero 2026

## Problema Real

Build de Vercel falló con error:
```
Module not found: Can't resolve 'swr'
```

## Root Cause REAL

**La librería `swr` NO se instaló en Vercel porque usó caché de build anterior**

Evidencia del log:
```
npm warn ERESOLVE overriding peer dependency
...
up to date in 2s  ← ⚠️ USÓ CACHÉ, NO INSTALÓ NUEVAS DEPENDENCIAS
```

## Análisis Incorrecto Anterior

❌ Pensé que el problema eran los imports `@/src/lib/` vs `@/lib/`  
✅ El problema REAL es que `swr` no se instaló porque Vercel usó caché

## Verificación

### package.json
```json
{
  "dependencies": {
    "swr": "^2.4.0"  ← ✅ SÍ está en package.json
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]  ← Significa @/ apunta a raíz, entonces @/src/lib/ es CORRECTO
    }
  }
}
```

## Solución

### Opción 1: Limpiar Caché de Vercel (Recomendado)
1. Ir a Vercel Dashboard
2. Settings → General → Clear Build Cache
3. Re-deploy

### Opción 2: Forzar Reinstalación con package-lock.json
```bash
# Eliminar package-lock.json
rm package-lock.json

# Reinstalar dependencias
npm install

# Commit y push
git add package-lock.json
git commit -m "chore: regenerar package-lock.json para forzar reinstalación en Vercel"
git push
```

### Opción 3: Agregar Script de Verificación
Agregar a `package.json`:
```json
{
  "scripts": {
    "vercel-build": "npm list swr && next build"
  }
}
```

## Cambios Revertidos

Revertí TODOS los cambios de imports porque eran INCORRECTOS:
- ✅ `@/src/lib/storage` es CORRECTO (según tsconfig con baseUrl: ".")
- ❌ `@/lib/storage` era INCORRECTO

## Próximos Pasos

1. ✅ Revertir cambios incorrectos de imports (HECHO)
2. ⏳ Limpiar caché de Vercel O regenerar package-lock.json
3. ⏳ Re-deploy en Vercel
4. ⏳ Verificar que build pasa

## Lecciones Aprendidas

1. **Leer logs completos**: "up to date in 2s" indica caché, no instalación
2. **Verificar tsconfig**: baseUrl y paths determinan cómo funcionan los aliases
3. **No asumir**: El error "Module not found" puede ser por caché, no por imports incorrectos
4. **Vercel caché**: A veces Vercel usa caché antiguo y no instala nuevas dependencias

## Commit Message (Si se regenera package-lock)

```bash
git add package-lock.json
git commit -m "chore: regenerar package-lock.json para forzar reinstalación de swr en Vercel

- Vercel usó caché de build anterior y no instaló swr
- Regenerado package-lock.json para forzar npm install completo
- Fix para error 'Module not found: Can't resolve swr'"

git push
```

---

**Fecha**: 13 Febrero 2026  
**Spec**: performance-optimization-vercel-best-practices  
**Problema**: Vercel no instaló swr por usar caché  
**Solución**: Limpiar caché de Vercel O regenerar package-lock.json  
**Estado**: ⏳ PENDIENTE - Requiere acción en Vercel Dashboard o regenerar lock file
