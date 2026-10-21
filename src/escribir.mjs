import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { esRareza } from './normalizar.mjs';

export const FORMATOS = ['imperio', 'pb', 'pe', 'fx'];

export function agruparSinEmparejar(sinEmparejar, limite = 400) {
  const grupos = new Map();
  for (const listado of sinEmparejar) {
    const pistas = listado.pistas.filter((p) => !(p.startsWith('cod:') && esRareza(p.slice(4)))).sort();
    const clave = `${listado.tienda}|${listado.motivo}|${pistas.join(' ')}`;
    const grupo = grupos.get(clave) ?? { tienda: listado.tienda, motivo: listado.motivo, pistas, cantidad: 0, ejemplos: [] };
    grupo.cantidad++;
    if (grupo.ejemplos.length < 5) grupo.ejemplos.push(listado.nombre);
    grupos.set(clave, grupo);
  }
  return [...grupos.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, limite);
}

export function escribirSitio(dir, { meta, comparativo, brechas, sinEmparejar, series }) {
  mkdirSync(dir, { recursive: true });
  const escribir = (nombre, valor) => writeFileSync(join(dir, nombre), JSON.stringify(valor));
  escribir('meta.json', meta);
  for (const formato of FORMATOS) {
    escribir(`cartas-${formato}.json`, comparativo.filter((c) => c.formato === formato));
    escribir(`series-${formato}.json`, series[formato] ?? {});
  }
  escribir('brechas.json', brechas);
  escribir('sin-emparejar.json', agruparSinEmparejar(sinEmparejar));
}
