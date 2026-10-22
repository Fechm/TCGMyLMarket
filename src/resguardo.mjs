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

export async function leerConResguardo({ tienda, clave = tienda.id, dir, ahora, leer }) {
  const anteriores = leerUltimos(dir, clave);
  try {
    const listados = await leer();
    const problema = validar(listados, anteriores?.listados);
    if (problema) throw new Error(problema);
    guardarUltimos(dir, clave, ahora, listados);
    return { tienda, listados, ultimaLectura: ahora, reutilizado: false, error: null };
  } catch (error) {
    return { tienda, listados: anteriores?.listados ?? [], ultimaLectura: anteriores?.fecha ?? null, reutilizado: true, error: error.message };
  }
}

export function resumirLectura({ tienda, listados, ultimaLectura, reutilizado, error }) {
  return {
    id: tienda.id,
    nombre: tienda.nombre,
    url: tienda.url,
    listados: listados.length,
    conStock: listados.filter((x) => x.stock).length,
    ultimaLectura,
    reutilizado,
    error,
  };
}
