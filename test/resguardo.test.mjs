import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PRECIO_MINIMO, guardarUltimos, leerConResguardo, leerUltimos, resumirLectura, validar } from '../src/resguardo.mjs';

const l = (precio, stock = true) => ({ precio, stock });

test('validar detecta lecturas vacías, truncadas o en otra moneda', () => {
  assert.equal(validar([], null), 'sin listados');
  assert.match(validar([l(1000)], [l(1), l(1), l(1)]), /solo 1 de 3/);
  assert.equal(validar([l(10), l(20), l(30)], null), 'precios fuera de rango');
  assert.equal(validar([l(1000), l(2000)], [l(1), l(1), l(1)]), null);
  assert.equal(validar([l(0, false)], null), null);
});

test('guarda y lee la última lectura buena', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ultimos-'));
  assert.equal(leerUltimos(dir, 'pandora'), null);
  guardarUltimos(dir, 'pandora', '2026-10-21T09:00:00.000Z', [l(1000)]);
  assert.deepEqual(leerUltimos(dir, 'pandora'), { fecha: '2026-10-21T09:00:00.000Z', listados: [l(1000)] });
});

test('una mediana de 50 o más se acepta', () => {
  assert.equal(PRECIO_MINIMO, 50);
  assert.equal(validar([l(50), l(100), l(100)], null), null);
});

test('leerConResguardo guarda la lectura buena con su clave', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ultimos-'));
  const tienda = { id: 'pandora', nombre: 'Pandora' };
  const lectura = await leerConResguardo({ tienda, clave: 'sellado-pandora', dir, ahora: 'hoy', leer: async () => [l(1000)] });
  assert.deepEqual(lectura, { tienda, listados: [l(1000)], ultimaLectura: 'hoy', reutilizado: false, error: null });
  assert.deepEqual(leerUltimos(dir, 'sellado-pandora'), { fecha: 'hoy', listados: [l(1000)] });
  assert.equal(leerUltimos(dir, 'pandora'), null);
});

test('leerConResguardo reutiliza la última lectura buena si falla o no valida', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ultimos-'));
  const tienda = { id: 'pandora' };
  guardarUltimos(dir, 'pandora', 'ayer', [l(1000), l(2000)]);
  const caida = await leerConResguardo({ tienda, dir, ahora: 'hoy', leer: async () => { throw new Error('HTTP 503'); } });
  assert.deepEqual(caida, { tienda, listados: [l(1000), l(2000)], ultimaLectura: 'ayer', reutilizado: true, error: 'HTTP 503' });
  const vacia = await leerConResguardo({ tienda, dir, ahora: 'hoy', leer: async () => [] });
  assert.equal(vacia.error, 'sin listados');
  assert.equal(vacia.listados.length, 2);
  assert.equal(leerUltimos(dir, 'pandora').fecha, 'ayer');
});

test('leerConResguardo sin lectura previa devuelve vacío con el error', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ultimos-'));
  const lectura = await leerConResguardo({ tienda: { id: 'x' }, dir, ahora: 'hoy', leer: async () => { throw new Error('caída'); } });
  assert.deepEqual([lectura.listados, lectura.ultimaLectura, lectura.reutilizado, lectura.error], [[], null, true, 'caída']);
});

test('resumirLectura cuenta listados y stock para meta', () => {
  const resumen = resumirLectura({
    tienda: { id: 'oneup', nombre: 'One Up Store', url: 'https://www.oneupstore.cl', lector: 'bsale' },
    listados: [l(1000), l(0, false), l(2000)], ultimaLectura: 'hoy', reutilizado: false, error: null,
  });
  assert.deepEqual(resumen, {
    id: 'oneup', nombre: 'One Up Store', url: 'https://www.oneupstore.cl', listados: 3, conStock: 2, ultimaLectura: 'hoy', reutilizado: false, error: null,
  });
});
