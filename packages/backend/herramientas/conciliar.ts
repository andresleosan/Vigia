// Conciliación D1/R2 desde la línea de órdenes (decisión 40). Uso, desde packages/backend:
//   node herramientas/conciliar.ts <volcado de D1 .json> <listado de R2 .json>
// Sale con 0 si todo casa, 1 si hay diferencias y 2 si falta una entrada o no es válida.
import { readFileSync } from 'node:fs';
import { conciliar, type Resultado } from './conciliacion.ts';

const [volcado, listado] = process.argv.slice(2);
if (!volcado || !listado) {
  console.error('Uso: node herramientas/conciliar.ts <volcado de D1 .json> <listado de R2 .json>');
  process.exit(2);
}
let resultado: Resultado;
try {
  resultado = conciliar(readFileSync(volcado, 'utf8'), readFileSync(listado, 'utf8'));
} catch (e) {
  console.error(`Entrada no válida: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(2);
}
console.log(resultado.lineas.join('\n'));
process.exitCode = resultado.diferencias === 0 ? 0 : 1;
