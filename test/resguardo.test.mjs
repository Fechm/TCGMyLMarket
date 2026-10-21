import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guardarUltimos, leerUltimos, validar } from '../src/resguardo.mjs';

const l = (precio, stock = true) => ({ precio, stock });

test('validar detecta lecturas vacías, truncadas o en otra moneda', () => {
  assert.equal(validar([], null), 'sin listados');
  assert.match(validar([l(1000)], [l(1), l(1), l(1)]), /solo 1 de 3/);
  assert.equal(validar([l(50), l(60), l(70)], null), 'precios fuera de rango');
  assert.equal(validar([l(1000), l(2000)], [l(1), l(1), l(1)]), null);
  assert.equal(validar([l(0, false)], null), null);
});

test('guarda y lee la última lectura buena', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ultimos-'));
  assert.equal(leerUltimos(dir, 'pandora'), null);
  guardarUltimos(dir, 'pandora', '2026-10-21T09:00:00.000Z', [l(1000)]);
  assert.deepEqual(leerUltimos(dir, 'pandora'), { fecha: '2026-10-21T09:00:00.000Z', listados: [l(1000)] });
});
