import { type Cripto, criptoWebCrypto } from '../src/cripto.ts';

// Cripto de pruebas y vectores (sección 18): `aleatorio` devuelve, en orden, los bloques dados.
export function criptoDeterminista(...bloques: Uint8Array[]): Cripto {
  return {
    ...criptoWebCrypto(),
    aleatorio(n) {
      const b = bloques.shift();
      if (b?.length !== n) throw new Error(`aleatorio de prueba: no hay un bloque de ${n} bytes`);
      return b;
    },
  };
}
