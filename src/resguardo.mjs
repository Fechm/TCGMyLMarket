import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mediana } from './calcular.mjs';

export const PROPORCION_MINIMA = 0.5;
export const PRECIO_MINIMO = 50;

export function validar(listados, anteriores) {
  if (!listados.length) return 'sin listados';
  if (anteriores?.length && listados.length < anteriores.length * PROPORCION_MINIMA) {
    return `solo ${listados.length} de ${anteriores.length} listados`;
  }
  const precios = listados.filter((l) => l.stock).map((l) => l.precio);
  if (precios.length && mediana(precios) < PRECIO_MINIMO) return 'precios fuera de rango';
  return null;
}

export function leerUltimos(dir, tienda) {
  try {
    return JSON.parse(readFileSync(join(dir, `${tienda}.json`), 'utf8'));
  } catch {
    return null;
  }
}

export function guardarUltimos(dir, tienda, fecha, listados) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${tienda}.json`), JSON.stringify({ fecha, listados }));
}
