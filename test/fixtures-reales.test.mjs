import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsearListado } from '../src/lectores/jumpseller.mjs';
import { leer as leerShopify } from '../src/lectores/shopify.mjs';
import { leer as leerWoo } from '../src/lectores/woocommerce.mjs';

const fixture = (nombre) => readFileSync(new URL(`./fixtures/${nombre}`, import.meta.url), 'utf8');

function verificar(listados, prefijoUrl) {
  assert.ok(listados.length > 0);
  for (const l of listados) {
    assert.ok(l.id, 'id');
    assert.ok(l.nombre.length > 1, 'nombre');
    assert.ok(l.url.startsWith(prefijoUrl), l.url);
    assert.equal(Number.isInteger(l.precio), true);
    if (l.stock) assert.ok(l.precio >= 100, `${l.nombre}: ${l.precio}`);
  }
}

for (const [tienda, url, ruta, categoria] of [
  ['laira', 'https://laira.cl', '/wp-json/wc/store/v1/products', 259],
  ['minimarket', 'https://minimarketcg.cl', '/wp-json/wc/store/v1/products', 29],
  ['jpstore', 'https://jpstore.cl', '/wp-json/wc/store/products', 16],
]) {
  test(`woocommerce real: ${tienda}`, async () => {
    const cliente = { json: async () => ({ datos: JSON.parse(fixture(`${tienda}.json`)), headers: new Headers({ 'x-wp-totalpages': '1' }) }) };
    const listados = await leerWoo({ id: tienda, url, ruta, categorias: [{ id: categoria, formato: null }] }, cliente);
    verificar(listados, url);
    assert.ok(listados.every((l) => !/&#\d+;/.test(l.nombre)), 'entidades sin decodificar');
  });
}

test('shopify real: devastation', async () => {
  const cliente = { json: async () => ({ datos: JSON.parse(fixture('devastation.json')) }) };
  const listados = await leerShopify({ id: 'devastation', url: 'https://storedevastation.com', coleccion: 'cartas-mitos-y-leyendas', tagsIgnorados: [] }, cliente);
  verificar(listados, 'https://storedevastation.com/products/');
});

for (const [tienda, url, minimo] of [['mylserena', 'https://mylserena.cl', 25], ['pandora', 'https://www.pandorastore.cl', 20]]) {
  test(`jumpseller real: ${tienda}`, () => {
    const { productos, ultima } = parsearListado(fixture(`${tienda}.html`), url);
    assert.ok(productos.length >= minimo, `solo ${productos.length}`);
    assert.ok(ultima > 10, `ultima ${ultima}`);
    verificar(productos, url);
    assert.ok(productos.some((p) => p.stock), 'ningún producto con stock en la página 1');
  });
}
