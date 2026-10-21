import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leer } from '../../src/lectores/woocommerce.mjs';

function clienteFalso(paginas) {
  const pedidas = [];
  return {
    pedidas,
    async json(url) {
      pedidas.push(url);
      const pagina = paginas[url];
      if (!pagina) throw new Error(`URL no esperada ${url}`);
      return { datos: pagina.datos, headers: new Headers({ 'X-WP-TotalPages': String(pagina.total) }) };
    },
  };
}

const base = 'https://laira.cl/wp-json/wc/store/v1/products';
const config = {
  id: 'laira', url: 'https://laira.cl', ruta: '/wp-json/wc/store/v1/products', excluir: '^pedido',
  categorias: [{ id: 266, formato: 'pe' }, { id: 267, formato: null }],
};
const producto = (id, extra = {}) => ({
  id, name: `Carta ${id}`, permalink: `https://laira.cl/producto/${id}/`, is_in_stock: true,
  prices: { price: '2500', currency_minor_unit: 0 }, images: [{ src: 's.jpg', thumbnail: 't.jpg' }],
  categories: [{ id: 267 }], ...extra,
});

test('pagina por categoría, deduplica y combina pistas y formato', async () => {
  const cliente = clienteFalso({
    [`${base}?category=266&per_page=100&page=1`]: { total: 2, datos: [producto(1), producto(2, { name: 'Dub &#8211; Sar FOIL', is_in_stock: false })] },
    [`${base}?category=266&per_page=100&page=2`]: { total: 2, datos: [producto(3, { prices: { price: '0' } })] },
    [`${base}?category=267&per_page=100&page=1`]: { total: 1, datos: [producto(1), producto(4, { name: 'Pedido Jaime 2' })] },
  });
  const listados = await leer(config, cliente);

  assert.equal(cliente.pedidas.length, 3);
  assert.deepEqual(listados.map((l) => l.id).sort(), ['1', '2', '3']);
  assert.deepEqual(listados.find((l) => l.id === '1'), {
    tienda: 'laira', id: '1', nombre: 'Carta 1', precio: 2500, stock: true,
    url: 'https://laira.cl/producto/1/', imagen: 't.jpg', pistas: ['cat:266', 'cat:267'], formato: 'pe',
  });
  const dos = listados.find((l) => l.id === '2');
  assert.equal(dos.nombre, 'Dub – Sar FOIL');
  assert.equal(dos.stock, false);
  const tres = listados.find((l) => l.id === '3');
  assert.deepEqual([tres.precio, tres.stock], [0, false]);
});

test('ruta legacy sin categorías en el producto usa la categoría consultada', async () => {
  const legacy = 'https://jpstore.cl/wp-json/wc/store/products';
  const cliente = clienteFalso({
    [`${legacy}?category=16&per_page=100&page=1`]: { total: 1, datos: [producto(9, { categories: [] })] },
    [`${legacy}?category=3973&per_page=100&page=1`]: { total: 1, datos: [producto(9, { categories: [] })] },
  });
  const listados = await leer({
    id: 'jpstore', url: 'https://jpstore.cl', ruta: '/wp-json/wc/store/products',
    categorias: [{ id: 16, formato: null }, { id: 3973, formato: 'pb' }],
  }, cliente);
  assert.deepEqual(listados[0].pistas, ['cat:16', 'cat:3973']);
  assert.equal(listados[0].formato, 'pb');
});

test('una página vacía corta la paginación', async () => {
  const cliente = clienteFalso({ [`${base}?category=266&per_page=100&page=1`]: { total: 5, datos: [] } });
  const listados = await leer({ ...config, categorias: [{ id: 266, formato: 'pe' }] }, cliente);
  assert.deepEqual(listados, []);
  assert.equal(cliente.pedidas.length, 1);
});
