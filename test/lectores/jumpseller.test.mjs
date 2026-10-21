import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leer, parsearListado } from '../../src/lectores/jumpseller.mjs';

const pagina = `
<article class="product-block" data-product-id="35845224">
  <a href="/carwennan-lpb-40-legendaria" class="product-block__name" title="Ir a Carwennan">Carwennan (LPB 4.0 - Legendaria)</a>
  <img src="https://cdnx.jumpseller.com/mylserena/image/1/resize/306/407" class="product-block__image">
  <div class="product-block__pricing"><div class="product-block__price">
    $20.000
  </div></div>
  <form action="/cart/add/35845224" class="product-block__form"><input class="product-block__input" data-price="20000.0" max="3"></form>
</article>
<article class="product-block" data-product-id="27253705">
  <div class="product-block__label product-block__label--status">Agotado</div>
  <a href="/fergus-mor-maceric-hd-aniversario-ur-aa" class="product-block__name">Fergus Mor Maceric (HD Aniversario - UR)</a>
  <div class="product-block__price">$6.000</div>
</article>
<article class="product-block" data-product-id="111">
  <a href="/salmon-del-saber" class="product-block__name">Salmón del Saber (HD Aniversario - Buy a Box)</a>
  <div class="product-block__price-wrapper">
    <div class="product-block__price product-block__price--new">$18.000</div>
    <div class="product-block__price product-block__price--old">$22.000</div>
  </div>
  <form class="product-block__form"></form>
</article>
<article class="product-block" data-product-id="222">
  <div class="product-block__label product-block__label--status">No disponible</div>
  <a href="/carnwennan-jo" class="product-block__name">Carnwennan (Juego Organizado)</a>
  <div class="product-block__price">$0</div>
</article>
<ul class="pager"><li class="next"><a href="?page=2">Siguiente</a></li><li class="last"><a href="/singles-pb-1?page=3">Último</a></li></ul>`;

test('parsearListado extrae productos, precios, stock y última página', () => {
  const { productos, ultima } = parsearListado(pagina, 'https://mylserena.cl');
  assert.equal(ultima, 3);
  assert.deepEqual(productos[0], {
    id: '35845224', nombre: 'Carwennan (LPB 4.0 - Legendaria)', url: 'https://mylserena.cl/carwennan-lpb-40-legendaria',
    imagen: 'https://cdnx.jumpseller.com/mylserena/image/1/resize/306/407', precio: 20000, stock: true,
  });
  assert.deepEqual([productos[1].precio, productos[1].stock, productos[1].imagen], [6000, false, null]);
  assert.deepEqual([productos[2].precio, productos[2].stock], [18000, true]);
  assert.deepEqual([productos[3].precio, productos[3].stock], [0, false]);
});

test('sin pager la última página es 1', () => {
  assert.equal(parsearListado('<article class="product-block" data-product-id="1"><a class="product-block__name" href="/a">A</a></article>', 'https://x.cl').ultima, 1);
});

const bloque = (id, nombre) => `<article class="product-block" data-product-id="${id}"><a class="product-block__name" href="/${id}">${nombre}</a><div class="product-block__price">$1.000</div><form class="product-block__form"></form></article>`;
const pager = (ultima) => `<ul class="pager"><li class="last"><a href="?page=${ultima}">Último</a></li></ul>`;

test('leer recorre categorías y páginas, y combina pistas de un mismo producto', async () => {
  const paginas = {
    'https://mylserena.cl/singles-pb-1?page=1': bloque('1', 'A (LPB 4.0)') + pager(2),
    'https://mylserena.cl/singles-pb-1?page=2': bloque('2', 'B (LPB 4.0)') + pager(2),
    'https://mylserena.cl/singles-pb-1/leyendas-pb-40?page=1': bloque('1', 'A (LPB 4.0)'),
  };
  const pedidas = [];
  const cliente = {
    async texto(url) {
      pedidas.push(url);
      if (!(url in paginas)) throw new Error(`URL no esperada ${url}`);
      return paginas[url];
    },
  };
  const listados = await leer({
    id: 'mylserena', url: 'https://mylserena.cl',
    categorias: [{ ruta: 'singles-pb-1', formato: 'pb' }, { ruta: 'singles-pb-1/leyendas-pb-40', formato: 'pb' }],
  }, cliente);
  assert.equal(pedidas.length, 3);
  assert.equal(listados.length, 2);
  const a = listados.find((l) => l.id === '1');
  assert.equal(a.tienda, 'mylserena');
  assert.deepEqual(a.pistas, ['ruta:singles-pb-1', 'ruta:singles-pb-1/leyendas-pb-40']);
  assert.equal(a.formato, 'pb');
});

const plantilla = readFileSync(new URL('../fixtures/mylserena-subcategorias.html', import.meta.url), 'utf8');
const seccion = (ruta) => `<section id="theme-section-category-subcategories-template-1"><a href="/${ruta}" class="theme-section__link" title="Ver Más">Ver Más</a></section>`;

test('parsearListado detecta las subcategorías de la plantilla y no las del menú', () => {
  const { productos, subcategorias } = parsearListado(plantilla, 'https://mylserena.cl');
  assert.deepEqual(subcategorias, ['singles-imperio/dracula-rey-vampiro/reales', 'singles-imperio/dracula-rey-vampiro/promocionales']);
  assert.deepEqual(productos.map((p) => p.id), ['37505679', '37505680', '37505800']);
  assert.deepEqual(parsearListado(pagina, 'https://mylserena.cl').subcategorias, []);
});

test('leer recorre subcategorías con sus páginas y suma las pistas de las categorías ancestro', async () => {
  const padre = 'singles-imperio/dracula-rey-vampiro';
  const paginas = {
    [`https://mylserena.cl/${padre}?page=1`]: plantilla,
    [`https://mylserena.cl/${padre}/reales?page=1`]: bloque('37505679', 'Pricolici (Drácula - Real)') + bloque('900', 'X (Drácula - Real)') + pager(2),
    [`https://mylserena.cl/${padre}/reales?page=2`]: bloque('901', 'Y (Drácula - Real)') + pager(2),
    [`https://mylserena.cl/${padre}/promocionales?page=1`]: bloque('37505800', 'Vlad Tepes') + seccion(`${padre}/promocionales/foil`) + seccion(`${padre}/reales`) + seccion(padre),
    [`https://mylserena.cl/${padre}/promocionales/foil?page=1`]: bloque('950', 'Z (Drácula - Foil)') + seccion(`${padre}/promocionales/foil`),
  };
  const pedidas = [];
  const cliente = {
    async texto(url) {
      pedidas.push(url);
      if (!(url in paginas)) throw new Error(`URL no esperada ${url}`);
      return paginas[url];
    },
  };
  const listados = await leer({ id: 'mylserena', url: 'https://mylserena.cl', categorias: [{ ruta: padre, formato: 'imperio' }] }, cliente);
  assert.deepEqual(pedidas.sort(), Object.keys(paginas).sort());
  assert.deepEqual(listados.map((l) => l.id).sort(), ['37505679', '37505680', '37505800', '900', '901', '950']);
  const pistas = (id) => listados.find((l) => l.id === id).pistas;
  assert.deepEqual(pistas('37505679'), [`ruta:${padre}`, `ruta:${padre}/reales`]);
  assert.deepEqual(pistas('37505680'), [`ruta:${padre}`]);
  assert.deepEqual(pistas('901'), [`ruta:${padre}`, `ruta:${padre}/reales`]);
  assert.deepEqual(pistas('950'), [`ruta:${padre}`, `ruta:${padre}/promocionales`, `ruta:${padre}/promocionales/foil`]);
  assert.ok(listados.every((l) => l.formato === 'imperio'));
});
