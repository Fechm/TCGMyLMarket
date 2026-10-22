import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRECIO_MAXIMO, leer } from '../../src/lectores/shopify.mjs';

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

test('precio sobre el máximo cuenta como sin stock y precio 0', async () => {
  const cliente = {
    json: async () => ({ datos: { products: [{ id: 1, title: 'Basura', handle: 'basura', tags: [], variants: [{ available: true, price: '2000000' }] }] } }),
  };
  const [listado] = await leer(config, cliente);
  assert.equal(PRECIO_MAXIMO, 1000000);
  assert.deepEqual([listado.precio, listado.stock], [0, false]);
});

test('descarta imagen con esquemas distintos de http y https', async () => {
  const cliente = {
    json: async () => ({ datos: { products: [{ id: 2, title: 'A', handle: 'a', tags: [], variants: [{ available: true, price: '100' }], images: [{ src: 'javascript:alert(1)' }] }] } }),
  };
  const [listado] = await leer({ ...config, url: 'javascript:alert(1)//' }, cliente);
  assert.deepEqual([listado.url, listado.imagen], [null, null]);
});

test('expandirVariantes genera un listado por variante con su precio y stock', async () => {
  const { products } = JSON.parse(readFileSync(new URL('../fixtures/devastation-sellado.json', import.meta.url), 'utf8'));
  const cliente = { json: async () => ({ datos: { products } }) };
  const listados = await leer({ ...config, coleccion: 'productos-mitos-y-leyendas', expandirVariantes: true }, cliente);
  assert.equal(listados.length, 11);
  assert.deepEqual(listados[0], {
    tienda: 'devastation', id: '8509119758507:45573249892523', nombre: 'Kit de Batalla Dominios de Ra, Seth - 1 KIT', precio: 25000, stock: true,
    url: 'https://storedevastation.com/products/kit-de-batalla-helenica-afrodita-copia',
    imagen: products[0].images[0].src, pistas: ['tag:Almacen CHILE', 'tag:SEALED MYL'], formato: null,
  });
  assert.deepEqual([listados[1].nombre, listados[1].precio, listados[1].stock], ['Kit de Batalla Dominios de Ra, Seth - 3 KIT', 0, false]);
  const racial = listados.filter((l) => l.id.startsWith('8051085639851:'));
  assert.equal(racial.length, 9);
  assert.deepEqual(racial.slice(0, 2).map((l) => [l.nombre, l.precio, l.stock]), [
    ['KIT Racial Imperio 2024 - SOMBRA', 0, false],
    ['KIT Racial Imperio 2024 - SACERDOTE', 17000, true],
  ]);
});

test('expandirVariantes deja solo el título con Default Title y respeta el máximo', async () => {
  const cliente = {
    json: async () => ({
      datos: {
        products: [{
          id: 3, title: 'Display', handle: 'display', tags: [],
          variants: [{ id: 30, title: 'Default Title', available: true, price: '59000' }, { id: 31, title: '3 DISPLAY', available: true, price: '2000000' }],
        }],
      },
    }),
  };
  const listados = await leer({ ...config, expandirVariantes: true }, cliente);
  assert.deepEqual(listados.map((l) => [l.id, l.nombre, l.precio, l.stock]), [
    ['3:30', 'Display', 59000, true],
    ['3:31', 'Display - 3 DISPLAY', 0, false],
  ]);
});
