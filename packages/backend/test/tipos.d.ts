// Tipos de las pruebas: el entorno de Miniflare (con las migraciones y la pública del acuse) y los ?raw de Vite.
type EntornoDePrueba = import('../src/entorno.ts').Entorno & {
  MIGRACIONES: import('cloudflare:test').D1Migration[];
  SPKI_ACUSE_PRUEBA: string;
};

declare namespace Cloudflare {
  interface Env extends EntornoDePrueba {}
}

declare module '*?raw' {
  const texto: string;
  export default texto;
}
