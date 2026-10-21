import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const ARCHIVO = /^\d{4}-\d{2}-\d{2}\.json\.gz$/;

export function registroDelDia(resumenes, propia) {
  const registro = {};
  for (const r of resumenes) {
    const propio = r.tiendas.find((t) => t.tienda === propia);
    registro[r.clave] = [r.market, r.nTiendas, propio?.precio ?? null];
  }
  return registro;
}

export function guardarDia(dir, fecha, registro) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${fecha}.json.gz`), gzipSync(JSON.stringify(registro)));
}

export function leerDias(dir, cantidad) {
  let archivos;
  try {
    archivos = readdirSync(dir).filter((f) => ARCHIVO.test(f)).sort().slice(-cantidad);
  } catch {
    return [];
  }
  return archivos.map((f) => ({
    fecha: f.slice(0, 10),
    registro: JSON.parse(gunzipSync(readFileSync(join(dir, f))).toString('utf8')),
  }));
}

export function series(dias, claves) {
  const salida = {};
  for (const clave of claves) {
    const puntos = dias.filter((d) => d.registro[clave]).map((d) => [d.fecha, d.registro[clave][0], d.registro[clave][2]]);
    if (puntos.length) salida[clave] = puntos;
  }
  return salida;
}
