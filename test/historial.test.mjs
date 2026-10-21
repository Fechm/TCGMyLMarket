import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guardarDia, leerDias, registroDelDia, series } from '../src/historial.mjs';

test('registroDelDia guarda market, tiendas y precio propio por clave', () => {
  const resumenes = [
    { clave: 'a|ed|normal', market: 1000, nTiendas: 2, tiendas: [{ tienda: 'laira', precio: 900 }] },
    { clave: 'b|ed|normal', market: null, nTiendas: 1, tiendas: [] },
  ];
  assert.deepEqual(registroDelDia(resumenes, 'laira'), { 'a|ed|normal': [1000, 2, 900], 'b|ed|normal': [null, 1, null] });
});

test('guarda comprimido y lee los últimos días en orden', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hist-'));
  guardarDia(dir, '2026-10-20', { a: [1, 2, 3] });
  guardarDia(dir, '2026-10-21', { a: [4, 2, 5] });
  guardarDia(dir, '2026-10-19', { a: [7, 2, null] });
  const dias = leerDias(dir, 2);
  assert.deepEqual(dias.map((d) => d.fecha), ['2026-10-20', '2026-10-21']);
  assert.deepEqual(series(dias, ['a', 'z']), { a: [['2026-10-20', 1, 3], ['2026-10-21', 4, 5]] });
});

test('leerDias sin carpeta devuelve vacío', () => {
  assert.deepEqual(leerDias(join(tmpdir(), 'no-existe-tcg-myl'), 90), []);
});
