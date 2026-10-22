import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LECTORES } from '../src/lectores/index.mjs';

const leerJson = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const { propia, tiendas } = leerJson('../config/tiendas.json');
const ediciones = leerJson('../config/ediciones.json');
const FORMATOS = ['imperio', 'pb', 'pe', 'fx'];
const PREFIJOS = { woocommerce: ['cat', 'cod'], jumpseller: ['ruta', 'cod'], shopify: ['tag', 'cod'] };

test('la tienda propia está configurada', () => {
  assert.ok(tiendas.some((t) => t.id === propia));
});

test('cada tienda usa un lector conocido y tiene id único', () => {
  assert.equal(new Set(tiendas.map((t) => t.id)).size, tiendas.length);
  for (const t of tiendas) assert.ok(LECTORES[t.lector], `lector desconocido en ${t.id}`);
});

test('cada edición es válida y sus alias calzan con el lector de la tienda', () => {
  for (const [id, edicion] of Object.entries(ediciones)) {
    assert.equal(typeof edicion.nombre, 'string', id);
    assert.ok(FORMATOS.includes(edicion.formato), `${id}: formato ${edicion.formato}`);
    for (const [tiendaId, alias] of Object.entries(edicion.alias ?? {})) {
      const tienda = tiendas.find((t) => t.id === tiendaId);
      assert.ok(tienda, `${id}: tienda ${tiendaId} no existe`);
      for (const pista of alias) {
        const [prefijo, valor] = [pista.slice(0, pista.indexOf(':')), pista.slice(pista.indexOf(':') + 1)];
        assert.ok(PREFIJOS[tienda.lector].includes(prefijo), `${id}: ${pista} no sirve para ${tienda.lector}`);
        assert.ok(valor.length > 0, `${id}: alias vacío`);
        if (prefijo === 'cat') assert.match(valor, /^\d+$/, `${id}: ${pista}`);
      }
    }
  }
});

test('hay al menos una edición reciente', () => {
  assert.ok(Object.values(ediciones).some((e) => e.reciente));
});

test('cada producto sellado tiene id único y una edición conocida del mismo formato', () => {
  const sellado = leerJson('../config/sellado.json');
  assert.equal(new Set(sellado.map((p) => p.id)).size, sellado.length);
  for (const p of sellado) {
    assert.ok(ediciones[p.edicion], `${p.id}: edición ${p.edicion} no existe`);
    assert.equal(p.formato, ediciones[p.edicion].formato, p.id);
    assert.ok(p.incluye.length > 0, `${p.id}: incluye vacío`);
    assert.ok(Array.isArray(p.excluye), p.id);
  }
});
