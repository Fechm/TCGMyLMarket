import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcularSellado, cantidad, identificar, normalizarSellado } from '../src/sellado.mjs';

const leerJson = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const catalogo = leerJson('../config/sellado.json');
const ediciones = leerJson('../config/ediciones.json');

test('normalizarSellado deja nombres comparables', () => {
  assert.equal(normalizarSellado('Display Drácula: Rey Vampiro – 24 Sobres'), 'display dracula rey vampiro 24 sobres');
  assert.equal(normalizarSellado('Display Pex Leyendas 4.0'), 'display primera era leyendas 4 0');
  assert.equal(normalizarSellado('Kit de Batalla PBX 4.0  - Draco'), 'kit batalla primer bloque 4 0 draco');
  assert.equal(normalizarSellado('Shogun 5 - Onna Musha Vol1'), 'shogun 5 onna musha vol 1');
  assert.equal(normalizarSellado('Especial Halloween – Abismo'), 'especial halloween abismo');
});

test('normalizarSellado aplica sinónimos y entidades', () => {
  assert.equal(normalizarSellado('LOOT BOX PRIMERA ERA 2025'), 'lootbox primera era 2025');
  assert.equal(normalizarSellado('Mistery Box Libertadores &#8211; Rapa Nui'), 'mystery box libertadores rapa nui');
  assert.equal(normalizarSellado('Volumen 2'), 'vol 2');
  assert.equal(normalizarSellado('Toolkit PE 2026 / PB'), 'toolkit primera era 2026 primer bloque');
  assert.equal(normalizarSellado('Display LBF 2026'), 'display leyendas bloque furia 2026');
  assert.equal(normalizarSellado('Toolkit FX'), 'toolkit furia extendido');
});

test('cantidad detecta packs de varias unidades', () => {
  assert.equal(cantidad('Display Drácula: Rey Vampiro – 24 Sobres X3'), 3);
  assert.equal(cantidad('3 Display Leyendas Primer Bloque 4.0 + 3 Buy a Box'), 3);
  assert.equal(cantidad('Kit de Batalla Draco (X3)'), 3);
  assert.equal(cantidad('PREVENTA 3 KIT DE BATALLA PBX 4.0'), 3);
  assert.equal(cantidad('Display + 4 Buy a Box'), 4);
  assert.equal(cantidad('Pack 6 Unidades Shogun'), 6);
  assert.equal(cantidad('Duo Pack Relatos de Ra'), 2);
});

test('cantidad es 1 para unidades sueltas aunque traigan regalos', () => {
  assert.equal(cantidad('PREVENTA DISPLAY LEYENDAS PRIMER BLOQUE 4.0 - PRIMER BLOQUE + 1 BUY A BOX'), 1);
  assert.equal(cantidad('Display Leyendas + 2 Buy a Box'), 1);
  assert.equal(cantidad('Kit Draco + 3 cartas Overframe'), 1);
  assert.equal(cantidad('Display 24 Sobres: Drácula, Rey Vampiro'), 1);
  assert.equal(cantidad('Pack 10 sobres Leyendas PE 4.0'), 1);
  assert.equal(cantidad('Shogun 5 - Onna Musha Vol1'), 1);
});

test('identificar reconoce el mismo display en cuatro tiendas', () => {
  const nombres = [
    'Display Drácula: Rey Vampiro – 24 Sobres',
    'Display Drácula: Rey Vampiro',
    'Display 24 Sobres: Drácula, Rey Vampiro',
    'Display Imperio Drácula',
  ];
  for (const nombre of nombres) assert.equal(identificar(catalogo, { nombre }), 'display-dracula-rey-vampiro', nombre);
});

test('identificar distingue el sobre del display', () => {
  assert.equal(identificar(catalogo, { nombre: 'Sobre: Drácula, Rey Vampiro' }), 'sobre-dracula-rey-vampiro');
  assert.equal(identificar(catalogo, { nombre: 'Sobre Imperio Drácula' }), 'sobre-dracula-rey-vampiro');
});

test('identificar respeta frases completas, alguno y abreviaturas', () => {
  assert.equal(identificar(catalogo, { nombre: 'Kit de Batalla PBX 4.0  - Draco' }), 'kit-pb4-draco');
  assert.equal(identificar(catalogo, { nombre: 'Shogun 5 - Onna Musha Vol1' }), 'shogun-5-vol-1');
  assert.equal(identificar(catalogo, { nombre: 'Especial Halloween – Abismo' }), 'ultratumba-abismo');
  assert.equal(identificar(catalogo, { nombre: 'Display Pex Leyendas 4.0' }), 'display-leyendas-pe-4');
  assert.equal(identificar(catalogo, { nombre: 'Abismo' }), null);
});

test('identificar descarta packs, ambiguos y desconocidos', () => {
  assert.equal(identificar(catalogo, { nombre: 'Display Drácula: Rey Vampiro – 24 Sobres X3' }), null);
  assert.equal(identificar(catalogo, { nombre: 'Kit de Batalla Draco y Sidhe' }), null);
  assert.equal(identificar(catalogo, { nombre: 'Funda Dragon Shield' }), null);
  assert.equal(identificar(catalogo, { nombre: '' }), null);
});

const mini = [
  { id: 'display-a', nombre: 'Display A', edicion: 'dracula-rey-vampiro', formato: 'imperio', tipo: 'display', reciente: true, incluye: ['display', 'alfa'], excluye: [] },
  { id: 'kit-b', nombre: 'Kit B', edicion: 'leyendas-pb-4', formato: 'pb', tipo: 'kit', reciente: true, incluye: ['kit', 'beta'], excluye: [] },
  { id: 'kit-c', nombre: 'Kit C', edicion: 'leyendas-pb-4', formato: 'pb', tipo: 'kit', reciente: false, incluye: ['kit', 'gamma'], excluye: [] },
  { id: 'kit-d', nombre: 'Kit D', edicion: 'leyendas-pb-4', formato: 'pb', tipo: 'kit', reciente: true, incluye: ['kit', 'delta'], excluye: [] },
  { id: 'kit-e', nombre: 'Kit E', edicion: 'leyendas-pb-4', formato: 'pb', tipo: 'kit', reciente: true, incluye: ['kit', 'epsilon'], excluye: [] },
];

const s = (tienda, nombre, precio, stock = true) => ({ tienda, nombre, precio, stock, url: `https://${tienda}.cl/${precio}` });

const calcularMini = (listados) => calcularSellado({ listados, catalogo: mini, ediciones, propia: 'laira' });

test('calcularSellado usa la mediana de otras tiendas y descarta atípicos', () => {
  const { comparativo } = calcularMini([
    s('laira', 'Kit Beta', 26990),
    s('devastation', 'Kit Beta', 26700),
    s('reino', 'Kit Beta', 26990),
    s('oneup', 'Kit Beta', 25990),
    s('pandora', 'Kit Beta', 98990),
    s('pandora', 'Kit Beta X3', 74990),
    s('minimarket', 'Kit Beta', 20000, false),
  ]);
  assert.equal(comparativo.length, 1);
  const fila = comparativo[0];
  assert.equal(fila.id, 'kit-b');
  assert.equal(fila.nombre, 'Kit B');
  assert.equal(fila.edicion, 'leyendas-pb-4');
  assert.equal(fila.formato, 'pb');
  assert.equal(fila.tipo, 'kit');
  assert.equal(fila.reciente, true);
  assert.equal(fila.precio, 26990);
  assert.equal(fila.stock, true);
  assert.equal(fila.url, 'https://laira.cl/26990');
  assert.equal(fila.market, 26700);
  assert.equal(fila.referencia, null);
  assert.equal(fila.min, 25990);
  assert.equal(fila.max, 26990);
  assert.equal(fila.nTiendas, 3);
  assert.equal(fila.conStock, 4);
  assert.equal(fila.sugerido, 26700);
  assert.equal(fila.estado, 'en-linea');
  assert.equal(fila.diferencia, 0.011);
  const pandora = fila.tiendas.find((t) => t.tienda === 'pandora');
  assert.deepEqual(pandora, { tienda: 'pandora', precio: 98990, stock: true, ambiguo: false, atipico: true, url: 'https://pandora.cl/98990' });
  assert.equal(fila.tiendas.find((t) => t.tienda === 'reino').atipico, false);
  assert.equal(fila.tiendas.length, 6);
});

test('calcularSellado redondea el sugerido a $10', () => {
  const { comparativo } = calcularMini([
    s('laira', 'Kit Beta', 26990), s('devastation', 'Kit Beta', 26700), s('reino', 'Kit Beta', 26990),
  ]);
  assert.equal(comparativo[0].market, 26845);
  assert.equal(comparativo[0].sugerido, 26850);
});

test('calcularSellado marca ambigua la tienda con dos precios y deja referencia con una sola', () => {
  const { comparativo } = calcularMini([
    s('laira', 'Kit Beta', 26990),
    s('devastation', 'Kit Beta', 26700),
    s('reino', 'Kit Beta', 24990),
    s('reino', 'Kit de batalla Beta', 27990),
  ]);
  const fila = comparativo[0];
  const reino = fila.tiendas.find((t) => t.tienda === 'reino');
  assert.equal(reino.ambiguo, true);
  assert.equal(reino.precio, null);
  assert.equal(fila.market, null);
  assert.equal(fila.referencia, 26700);
  assert.equal(fila.nTiendas, 1);
  assert.equal(fila.sugerido, null);
  assert.equal(fila.estado, null);
});

test('calcularSellado deja estado nulo si La Ira no tiene stock', () => {
  const { comparativo } = calcularMini([
    s('laira', 'Kit Beta', 40000, false), s('devastation', 'Kit Beta', 26700), s('reino', 'Kit Beta', 26990),
  ]);
  assert.equal(comparativo[0].estado, null);
  assert.equal(comparativo[0].stock, false);
  assert.ok(comparativo[0].diferencia > 0);
});

test('calcularSellado lista brechas ordenadas por reciente, tiendas con stock y valor', () => {
  const { comparativo, brechas } = calcularMini([
    s('laira', 'Display Alfa', 65990),
    s('devastation', 'Display Alfa', 65900),
    s('laira', 'Kit Beta', 26990, false),
    s('devastation', 'Kit Beta', 26700),
    s('devastation', 'Kit Gamma', 99990),
    s('reino', 'Kit Gamma', 99990),
    s('oneup', 'Kit Gamma', 99990),
    s('devastation', 'Kit Delta', 15000),
    s('reino', 'Kit Delta', 15000),
    s('devastation', 'Kit Epsilon', 30000),
    s('reino', 'Kit Epsilon', 30000),
    s('oneup', 'Kit Epsilon', 30000, false),
  ]);
  assert.deepEqual(comparativo.map((f) => f.id).sort(), ['display-a', 'kit-b']);
  assert.deepEqual(brechas.map((b) => b.id), ['kit-e', 'kit-d', 'kit-b', 'kit-c']);
  const delta = brechas.find((b) => b.id === 'kit-d');
  assert.deepEqual([delta.precio, delta.stock, delta.url, delta.estado], [null, false, null, null]);
  assert.equal(delta.market, 15000);
  const beta = brechas.find((b) => b.id === 'kit-b');
  assert.deepEqual([beta.precio, beta.stock, beta.referencia], [26990, false, 26700]);
});
