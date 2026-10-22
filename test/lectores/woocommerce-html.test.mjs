import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leer } from '../../src/lectores/woocommerce-html.mjs';

const recorte = readFileSync(new URL('../fixtures/elreinodelosduelos-recorte.html', import.meta.url), 'utf8');
const config = {
  id: 'reinodelosduelos', url: 'https://elreinodelosduelos.cl',
  categorias: [{ ruta: 'categoria-producto/mitos-y-leyendas', formato: 'sellado' }],
};

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

test('lee productos simples, variables y agotados de Woodmart', async () => {
  const cliente = clienteFalso({ 'https://elreinodelosduelos.cl/categoria-producto/mitos-y-leyendas/': recorte });
  const listados = await leer(config, cliente);
  assert.equal(cliente.pedidas.length, 1);
  assert.deepEqual(listados[0], {
    tienda: 'reinodelosduelos', id: '88847', nombre: 'Colección Legendaria Secreta: Hijos de Daana', precio: 27990, stock: true,
    url: 'https://elreinodelosduelos.cl/producto/coleccion-legendaria-secreta-hijos-de-daana/',
    imagen: 'https://elreinodelosduelos.cl/wp-content/uploads/2026/07/PRODUCTO-WEB-20-768x960.jpg',
    pistas: ['ruta:categoria-producto/mitos-y-leyendas', 'cat:myl-primer-bloque'], formato: 'sellado',
  });
  const variable = listados.find((l) => l.id === '92546');
  assert.deepEqual([variable.nombre, variable.precio, variable.stock], ['Display 24 Sobres: Drácula, Rey Vampiro', 65990, true]);
  const agotado = listados.find((l) => l.id === '86216');
  assert.deepEqual([agotado.precio, agotado.stock], [29990, false]);
});

test('pagina mientras haya enlace a la página siguiente', async () => {
  const siguiente = '<nav class="woocommerce-pagination"><a class="next page-numbers" href="/page/2/">→</a></nav>';
  const base = 'https://elreinodelosduelos.cl/categoria-producto/mitos-y-leyendas';
  const cliente = clienteFalso({
    [`${base}/`]: recorte.replace('</body>', `${siguiente}</body>`),
    [`${base}/page/2/`]: recorte.replaceAll('data-id="88847"', 'data-id="1"'),
  });
  const listados = await leer(config, cliente);
  assert.equal(cliente.pedidas.length, 2);
  assert.deepEqual(listados.map((l) => l.id).sort(), ['1', '86216', '88847', '92546']);
});

test('una página sin productos corta la paginación', async () => {
  const cliente = clienteFalso({ 'https://elreinodelosduelos.cl/categoria-producto/mitos-y-leyendas/': '<html><a class="next page-numbers" href="x">→</a></html>' });
  assert.deepEqual(await leer(config, cliente), []);
  assert.equal(cliente.pedidas.length, 1);
});

test('precio 0 implica sin stock y descarta enlaces no http', async () => {
  const html = '<div class="product-grid-item instock" data-id="7"><a class="product-image-link" href="javascript:alert(1)" aria-label="Sobre"><img data-src="javascript:alert(2)"></a><span class="price"></span></div>';
  const cliente = clienteFalso({ 'https://elreinodelosduelos.cl/categoria-producto/mitos-y-leyendas/': html });
  const [listado] = await leer(config, cliente);
  assert.deepEqual([listado.nombre, listado.precio, listado.stock, listado.url, listado.imagen], ['Sobre', 0, false, null, null]);
});
