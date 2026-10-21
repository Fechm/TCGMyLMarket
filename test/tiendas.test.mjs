import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoriasALeer } from '../src/tiendas.mjs';

const ediciones = {
  ultratumba: { formato: 'pe', alias: { mylserena: ['ruta:primera-era/singles-pe/leyendas-de-ultratumba', 'cod:HLPE26'], jpstore: ['cat:3973'] } },
  otra: { formato: 'pb', alias: { mylserena: ['ruta:singles-pb-1'] } },
};

test('jumpseller agrega las rutas de los alias sin duplicar', () => {
  const tienda = { id: 'mylserena', lector: 'jumpseller', leerAlias: true, categorias: [{ ruta: 'singles-pb-1', formato: 'pb' }] };
  assert.deepEqual(categoriasALeer(tienda, ediciones), [
    { ruta: 'singles-pb-1', formato: 'pb' },
    { ruta: 'primera-era/singles-pe/leyendas-de-ultratumba', formato: 'pe' },
  ]);
});

test('woocommerce agrega las categorías de los alias', () => {
  const tienda = { id: 'jpstore', lector: 'woocommerce', leerAlias: true, categorias: [{ id: 16, formato: null }] };
  assert.deepEqual(categoriasALeer(tienda, ediciones), [{ id: 16, formato: null }, { id: 3973, formato: 'pe' }]);
});

test('sin leerAlias deja solo las categorías configuradas', () => {
  const tienda = { id: 'jpstore', lector: 'woocommerce', leerAlias: false, categorias: [{ id: 16, formato: null }] };
  assert.deepEqual(categoriasALeer(tienda, ediciones), [{ id: 16, formato: null }]);
});

test('shopify sin categorías devuelve lista vacía', () => {
  assert.deepEqual(categoriasALeer({ id: 'devastation', lector: 'shopify' }, ediciones), []);
});
