import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcular, comparar, mediana, resumir } from '../src/calcular.mjs';

const l = (tienda, clave, precio, stock = true) => {
  const [nombreClave, edicion, variante] = clave.split('|');
  return {
    tienda, id: `${tienda}-${clave}-${precio}`, nombre: nombreClave, precio, stock,
    url: `https://${tienda}.cl/x`, imagen: null, pistas: [], formato: null,
    nombreClave, edicion, variante, clave,
  };
};

test('mediana con cantidad impar y par', () => {
  assert.equal(mediana([3000, 1000, 2000]), 2000);
  assert.equal(mediana([1000, 2000, 4000, 3000]), 2500);
  assert.equal(mediana([1500, 2000]), 1750);
});

test('comparar aplica el umbral de 15%', () => {
  assert.deepEqual(comparar(850, 1000), { diferencia: -0.15, estado: 'bajo' });
  assert.deepEqual(comparar(1149, 1000), { diferencia: 0.149, estado: 'en-linea' });
  assert.deepEqual(comparar(1150, 1000), { diferencia: 0.15, estado: 'sobre' });
  assert.equal(comparar(8504, 10000).estado, 'en-linea');
  assert.equal(comparar(11496, 10000).estado, 'en-linea');
  assert.deepEqual(comparar(1000, null), { diferencia: null, estado: null });
  assert.deepEqual(comparar(0, 1000), { diferencia: null, estado: null });
});

test('resumir excluye la tienda propia, los agotados y los ambiguos', () => {
  const clave = 'carta|ed1|normal';
  const r = resumir(clave, [
    l('laira', clave, 1500), l('mylserena', clave, 1000), l('pandora', clave, 2000),
    l('minimarket', clave, 9000, false), l('jpstore', clave, 1000), l('jpstore', clave, 2500),
  ], 'laira');
  assert.equal(r.market, 1500);
  assert.equal(r.nTiendas, 2);
  assert.equal(r.conStock, 3);
  assert.equal(r.min, 1000);
  assert.equal(r.max, 2000);
  assert.equal(r.sugerido, 1500);
  assert.equal(r.referencia, null);
  assert.equal(r.nombre, 'carta');
  const jp = r.tiendas.find((t) => t.tienda === 'jpstore');
  assert.equal(jp.ambiguo, true);
  assert.equal(jp.precio, null);
  const mm = r.tiendas.find((t) => t.tienda === 'minimarket');
  assert.deepEqual([mm.stock, mm.precio], [false, 9000]);
});

test('con una sola tienda queda como referencia', () => {
  const c = 'carta|ed1|normal';
  const r = resumir(c, [l('laira', c, 1000), l('pandora', c, 1234)], 'laira');
  assert.equal(r.market, null);
  assert.equal(r.referencia, 1234);
  assert.equal(r.sugerido, null);
  assert.equal(r.nTiendas, 1);
});

test('el sugerido redondea a $100', () => {
  const c = 'carta|ed1|normal';
  assert.equal(resumir(c, [l('mylserena', c, 1230), l('pandora', c, 1290)], 'laira').sugerido, 1300);
});

test('calcular arma el comparativo y las brechas ordenadas', () => {
  const ediciones = { ed1: { nombre: 'Ed 1', formato: 'pb' }, nueva: { nombre: 'Nueva', formato: 'imperio', reciente: true } };
  const emparejados = [
    l('laira', 'a|ed1|normal', 800), l('mylserena', 'a|ed1|normal', 1000), l('pandora', 'a|ed1|normal', 1000),
    l('mylserena', 'b|ed1|normal', 5000), l('pandora', 'b|ed1|normal', 7000),
    l('mylserena', 'c|nueva|normal', 3000),
    l('pandora', 'd|ed1|foil', 2000),
    l('laira', 'e|ed1|normal', 1000, false), l('mylserena', 'e|ed1|normal', 2000), l('pandora', 'e|ed1|normal', 2000),
  ];
  const sinEmparejar = [{ tienda: 'laira', nombreClave: 'd', variante: 'foil', stock: true }];
  const { comparativo, brechas } = calcular({ emparejados, sinEmparejar, ediciones, propia: 'laira' });

  assert.equal(comparativo.length, 2);
  const e = comparativo.find((c) => c.clave === 'e|ed1|normal');
  assert.equal(e.market, 2000);
  assert.equal(e.diferencia, -0.5);
  assert.equal(e.estado, null);
  const a = comparativo.find((c) => c.clave === 'a|ed1|normal');
  assert.equal(a.market, 1000);
  assert.equal(a.diferencia, -0.2);
  assert.equal(a.estado, 'bajo');
  assert.equal(a.formato, 'pb');
  assert.equal(a.tiendas.length, 3);

  assert.deepEqual(brechas.map((b) => b.clave), ['c|nueva|normal', 'b|ed1|normal', 'e|ed1|normal', 'd|ed1|foil']);
  assert.equal(brechas[0].reciente, true);
  assert.equal(brechas[0].formato, 'imperio');
  assert.equal(brechas.find((b) => b.clave === 'd|ed1|foil').otraVersion, true);
  assert.equal(brechas.find((b) => b.clave === 'b|ed1|normal').otraVersion, false);
});
