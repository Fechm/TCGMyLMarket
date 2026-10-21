import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { agruparSinEmparejar, escribirSitio } from '../src/escribir.mjs';

test('agrupa sin emparejar por tienda, motivo y pistas, ignorando rarezas', () => {
  const grupos = agruparSinEmparejar([
    { tienda: 'minimarket', motivo: 'sin-alias', nombre: 'A (LBPB25 - Legendaria)', pistas: ['cat:29', 'cod:lbpb25', 'cod:legendaria'] },
    { tienda: 'minimarket', motivo: 'sin-alias', nombre: 'B (LBPB25 - Real)', pistas: ['cod:lbpb25', 'cat:29', 'cod:real'] },
    { tienda: 'pandora', motivo: 'ambigua', nombre: 'C', pistas: ['cod:x'] },
  ]);
  assert.equal(grupos.length, 2);
  assert.deepEqual(grupos[0], {
    tienda: 'minimarket', motivo: 'sin-alias', pistas: ['cat:29', 'cod:lbpb25'], cantidad: 2,
    ejemplos: ['A (LBPB25 - Legendaria)', 'B (LBPB25 - Real)'],
  });
});

test('escribirSitio crea un archivo por formato y los generales', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sitio-'));
  escribirSitio(dir, {
    meta: { generado: 'x' },
    comparativo: [{ formato: 'pb', clave: 'a' }],
    brechas: [],
    sinEmparejar: [],
    series: { pb: { a: [] } },
  });
  assert.deepEqual(readdirSync(dir).sort(), [
    'brechas.json', 'cartas-fx.json', 'cartas-imperio.json', 'cartas-pb.json', 'cartas-pe.json', 'meta.json',
    'series-fx.json', 'series-imperio.json', 'series-pb.json', 'series-pe.json', 'sin-emparejar.json',
  ]);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'cartas-pb.json'), 'utf8')), [{ formato: 'pb', clave: 'a' }]);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'cartas-imperio.json'), 'utf8')), []);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'series-pe.json'), 'utf8')), {});
});
