import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leer as leerBsale } from '../src/lectores/bsale.mjs';
import { parsearListado } from '../src/lectores/jumpseller.mjs';
import { leer as leerShopify } from '../src/lectores/shopify.mjs';
import { leer as leerWoo } from '../src/lectores/woocommerce.mjs';
import { leer as leerWoodmart } from '../src/lectores/woocommerce-html.mjs';

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

test('woocommerce-html real: elreinodelosduelos', async () => {
  const cliente = { texto: async () => fixture('elreinodelosduelos.html') };
  const listados = await leerWoodmart({
    id: 'reinodelosduelos', url: 'https://elreinodelosduelos.cl',
    categorias: [{ ruta: 'categoria-producto/mitos-y-leyendas', formato: null }],
  }, cliente);
  assert.ok(listados.length >= 100, `solo ${listados.length}`);
  verificar(listados, 'https://elreinodelosduelos.cl/producto/');
  assert.ok(listados.some((l) => l.stock), 'ningún producto con stock');
  assert.ok(listados.some((l) => !l.stock), 'ningún producto agotado');
});

test('bsale real: oneupstore', async () => {
  const paginas = [fixture('oneupstore-1.html'), fixture('oneupstore-2.html')];
  const pedidas = [];
  const cliente = { texto: async (url) => { pedidas.push(url); return paginas[pedidas.length - 1]; } };
  const listados = await leerBsale({
    id: 'oneup', url: 'https://www.oneupstore.cl', categorias: [{ ruta: 'collection/imperio', formato: null }],
  }, cliente);
  assert.equal(pedidas.length, 2);
  assert.ok(listados.length >= 30, `solo ${listados.length}`);
  verificar(listados, 'https://www.oneupstore.cl/product/');
  assert.ok(listados.some((l) => l.stock), 'ningún producto con stock');
  assert.ok(listados.some((l) => !l.stock), 'ningún producto agotado');
});
