import { describe, expect, it } from 'vitest';

describe('humo', () => {
  it('corre en el Node fijado', () => {
    expect(process.version).toBe('v24.21.0');
  });

  it('carga el índice de shared', async () => {
    await expect(import('../src/index.ts')).resolves.toBeTypeOf('object');
  });
});
