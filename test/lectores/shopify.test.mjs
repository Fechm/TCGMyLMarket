import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leer } from '../../src/lectores/shopify.mjs';

const config = {
  id: 'devastation', url: 'https://storedevastation.com', coleccion: 'cartas-mitos-y-leyendas',
  tagsIgnorados: ['wk_global', 'Devastation Providencia'],
};

test('lee productos, ignora precio de no disponibles y filtra tags', async () => {
  const pedidas = [];
  const cliente = {
    async json(url) {
      pedidas.push(url);
      return {
        datos: {
          products: [
            {
              id: 4410351255634, title: 'Gebre Mesqel Lalibela', handle: 'gebre-mesqel-lalibela-ultra-real',
              tags: ['Devastation Providencia', 'Kilimanjaro'],
              variants: [{ available: true, price: '3000' }], images: [{ src: 'https://cdn.shopify.com/a.png' }],
            },
            {
              id: 6939121516715, title: 'Expulsión ACR-196', handle: 'expulsion-acr-196',
              tags: ['Acero', 'wk_global'], variants: [{ available: false, price: '80000000' }], images: [],
            },
          ],
        },
      };
    },
  };
  const listados = await leer(config, cliente);
  assert.deepEqual(pedidas, ['https://storedevastation.com/collections/cartas-mitos-y-leyendas/products.json?limit=250&page=1']);
  assert.deepEqual(listados[0], {
    tienda: 'devastation', id: '4410351255634', nombre: 'Gebre Mesqel Lalibela', precio: 3000, stock: true,
    url: 'https://storedevastation.com/products/gebre-mesqel-lalibela-ultra-real',
    imagen: 'https://cdn.shopify.com/a.png', pistas: ['tag:Kilimanjaro'], formato: null,
  });
  assert.deepEqual([listados[1].precio, listados[1].stock, listados[1].pistas], [0, false, ['tag:Acero']]);
});

test('sigue paginando mientras la página venga llena', async () => {
  const llena = Array.from({ length: 250 }, (_, i) => ({ id: i, title: `C${i}`, handle: `c${i}`, tags: [], variants: [{ available: true, price: '100' }] }));
  const respuestas = [llena, []];
  const cliente = { json: async () => ({ datos: { products: respuestas.shift() } }) };
  const listados = await leer(config, cliente);
  assert.equal(listados.length, 250);
  assert.equal(respuestas.length, 0);
});
