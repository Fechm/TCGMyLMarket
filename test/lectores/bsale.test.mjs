import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leer } from '../../src/lectores/bsale.mjs';

const fixture = (nombre) => readFileSync(new URL(`../fixtures/${nombre}`, import.meta.url), 'utf8');
const config = { id: 'oneup', url: 'https://www.oneupstore.cl', categorias: [{ ruta: 'collection/imperio', formato: 'sellado' }] };

function clienteFalso(paginas) {
  const pedidas = [];
  return {
    pedidas,
    async texto(url) {
      pedidas.push(url);
      if (!(url in paginas)) throw new Error(`URL no esperada ${url}`);
      return paginas[url];
    },
  };
}

test('pagina hasta que no hay página siguiente y marca agotados', async () => {
  const cliente = clienteFalso({
    'https://www.oneupstore.cl/collection/imperio?page=1': fixture('oneupstore-recorte-1.html'),
    'https://www.oneupstore.cl/collection/imperio?page=2': fixture('oneupstore-recorte-2.html'),
  });
  const listados = await leer(config, cliente);
  assert.equal(cliente.pedidas.length, 2);
  assert.deepEqual(listados[0], {
    tienda: 'oneup', id: '6791', nombre: 'Pack Drácula - Nóctulo x3', precio: 489990, stock: true,
    url: 'https://www.oneupstore.cl/product/pack-dracula-noctulo-x3',
    imagen: 'https://dojiw2m9tvv09.cloudfront.net/29535/product/M_allx38569.png?159&t=1792628763',
    pistas: ['ruta:collection/imperio'], formato: 'sellado',
  });
  assert.deepEqual(listados.slice(1).map((l) => [l.id, l.nombre, l.precio, l.stock]), [
    ['5734', 'Mystery Box Imperio Tierra Del Fuego', 10990, true],
    ['6352', 'Toolkit Imperio 2026 x3', 147990, false],
  ]);
});

test('una página sin productos corta la paginación', async () => {
  const cliente = clienteFalso({ 'https://www.oneupstore.cl/collection/imperio?page=1': '<ul class="pagination"><a class="page-link" href="/collection/imperio?page=2">2</a></ul>' });
  assert.deepEqual(await leer(config, cliente), []);
  assert.equal(cliente.pedidas.length, 1);
});

test('botón deshabilitado o precio 0 implica sin stock', async () => {
  const html = `<div data-bs="product" data-info="1"><a href="/product/a" title="A"></a><div class="bs-collection__product-final-price">$ 5.000</div><button disabled>Agregar</button></div>
<div data-bs="product" data-info="2"><a href="javascript:alert(1)" title="B"><img src="javascript:alert(2)"></a><div class="bs-collection__product-final-price"></div><button>Agregar</button></div>`;
  const cliente = clienteFalso({ 'https://www.oneupstore.cl/collection/imperio?page=1': html });
  const listados = await leer(config, cliente);
  assert.deepEqual(listados.map((l) => [l.id, l.precio, l.stock, l.url, l.imagen]), [
    ['1', 5000, false, 'https://www.oneupstore.cl/product/a', null],
    ['2', 0, false, null, null],
  ]);
});
