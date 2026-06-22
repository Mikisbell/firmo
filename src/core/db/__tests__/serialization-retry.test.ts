/**
 * Unit del retry de serialización del ingest. Reproduce el bug 40001
 * ("could not serialize access due to concurrent update") que tiraba 500
 * cuando varios terminales del mismo tenant sincronizaban a la vez.
 */
import { describe, it, expect, vi } from 'vitest';
import { isSerializationError, runWithSerializationRetry } from '../serialization-retry';

const noSleep = async () => {};

// Imita el PrismaClientKnownRequestError que aflora desde $executeRaw.
function pgError(message: string, code = 'P2010') {
  return Object.assign(new Error(message), { code });
}

describe('isSerializationError', () => {
  it('detecta 40001 (serialization_failure) en el mensaje crudo de $executeRaw', () => {
    expect(isSerializationError(pgError('Raw query failed. Code: `40001`. Message: `could not serialize access due to concurrent update`'))).toBe(true);
  });

  it('detecta 40P01 (deadlock) y el código P2034 de Prisma', () => {
    expect(isSerializationError(pgError('Code: `40P01`. deadlock detected'))).toBe(true);
    expect(isSerializationError(pgError('write conflict', 'P2034'))).toBe(true);
  });

  it('NO marca errores ajenos (ej: violación de FK)', () => {
    expect(isSerializationError(pgError('Foreign key constraint failed', 'P2003'))).toBe(false);
    expect(isSerializationError(new Error('boom'))).toBe(false);
  });
});

describe('runWithSerializationRetry', () => {
  it('reintenta y termina OK cuando un 40001 transitorio se resuelve', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw pgError('Code: `40001`. could not serialize access due to concurrent update');
      return 'ok';
    });

    const result = await runWithSerializationRetry(fn, 4, noSleep);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3); // 2 fallos transitorios + 1 éxito
  });

  it('propaga de inmediato un error NO transitorio (sin reintentar)', async () => {
    const fn = vi.fn(async () => { throw pgError('FK violation', 'P2003'); });

    await expect(runWithSerializationRetry(fn, 4, noSleep)).rejects.toThrow('FK violation');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('se rinde tras agotar los reintentos y propaga el último 40001', async () => {
    const fn = vi.fn(async () => { throw pgError('Code: `40001`. could not serialize access'); });

    await expect(runWithSerializationRetry(fn, 2, noSleep)).rejects.toThrow(/40001/);
    expect(fn).toHaveBeenCalledTimes(3); // intento inicial + 2 reintentos
  });
});
