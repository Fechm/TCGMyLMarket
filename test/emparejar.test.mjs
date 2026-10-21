import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearIndice, emparejar, normalizarPista } from '../src/emparejar.mjs';

const ediciones = {
  'leyendas-pb-4': { nombre: 'LPB 4.0', formato: 'pb', alias: { mylserena: ['cod:LPB 4.0'], pandora: ['cod:LPB4'] } },
  onyria: { nombre: 'Onyria', formato: 'imperio', alias: { laira: ['cat:338'], mylserena: ['ruta:singles-imperio/onyria'] } },
  'dracula-pb': { nombre: 'Drácula PB', formato: 'pb', alias: { mylserena: ['cod:Drácula'] } },
  'dracula-rey-vampiro': { nombre: 'DRV', formato: 'imperio', alias: { mylserena: ['ruta:singles-imperio/dracula-rey-vampiro'] } },
};

const listado = (extra) => ({
  tienda: 'mylserena', id: '1', nombre: 'X', precio: 1000, stock: true,
  url: 'https://x.cl/1', imagen: null, pistas: [], formato: null, ...extra,
});

const unico = (indice, extra) => {
  const { emparejados, sinEmparejar } = emparejar(indice, [listado(extra)]);
  return emparejados[0] ?? sinEmparejar[0];
};

test('normalizarPista', () => {
  assert.equal(normalizarPista('cod:LPB 4.0'), 'cod:lpb 4 0');
  assert.equal(normalizarPista('ruta:Singles-Imperio/Onyria'), 'ruta:singles-imperio/onyria');
  assert.equal(normalizarPista('cat:338'), 'cat:338');
  assert.equal(normalizarPista('tag:Kilimanjaro'), 'tag:kilimanjaro');
});

test('empareja por código en el nombre', () => {
  const indice = crearIndice(ediciones);
  assert.equal(unico(indice, { nombre: 'Carwennan (LPB 4.0 - Legendaria)' }).clave, 'carwennan|leyendas-pb-4|normal');
  assert.equal(
    unico(indice, { tienda: 'pandora', nombre: 'NACIMIENTO DE PEGASO - LPB4 - SECRETA' }).clave,
    'nacimiento de pegaso|leyendas-pb-4|secreta',
  );
});

test('empareja por categoría de la tienda propia y agrega los códigos a las pistas', () => {
  const r = unico(crearIndice(ediciones), { tienda: 'laira', nombre: 'Kappa FOIL', pistas: ['cat:264', 'cat:338'], formato: 'imperio' });
  assert.equal(r.clave, 'kappa|onyria|foil');
  assert.equal(r.edicion, 'onyria');
  assert.equal(r.nombreClave, 'kappa');
  assert.equal(r.variante, 'foil');
});

test('la pista fuerte gana a la débil', () => {
  const r = unico(crearIndice(ediciones), {
    nombre: 'Paladín Harker (Drácula - Secreta)',
    pistas: ['ruta:singles-imperio', 'ruta:singles-imperio/dracula-rey-vampiro'],
    formato: 'imperio',
  });
  assert.equal(r.clave, 'paladin harker|dracula-rey-vampiro|secreta');
});

test('si una pista fuerte calzó, las débiles se ignoran aunque el formato descarte las fuertes', () => {
  const r = unico(crearIndice(ediciones), {
    nombre: 'Carta (LPB 4.0)',
    pistas: ['ruta:singles-imperio/onyria'],
    formato: 'pb',
  });
  assert.equal(r.motivo, 'sin-alias');
});

test('sin pista fuerte usa la débil', () => {
  const r = unico(crearIndice(ediciones), { nombre: 'Paladín Harker (Drácula - Secreta)', pistas: ['ruta:singles-pb-1'], formato: 'pb' });
  assert.equal(r.clave, 'paladin harker|dracula-pb|secreta');
});

test('el formato descarta ediciones de otro formato', () => {
  const r = unico(crearIndice(ediciones), { nombre: 'Paladín Harker (Drácula - Secreta)', pistas: ['ruta:singles-imperio'], formato: 'imperio' });
  assert.equal(r.clave, undefined);
  assert.equal(r.motivo, 'sin-alias');
});

test('sin alias va a sin emparejar', () => {
  const r = unico(crearIndice(ediciones), { tienda: 'jpstore', nombre: 'Abbey Lubber', pistas: ['cat:16'] });
  assert.equal(r.motivo, 'sin-alias');
  assert.equal(r.nombreClave, 'abbey lubber');
});

test('dos ediciones con el mismo alias es ambigua', () => {
  const indice = crearIndice({
    a: { nombre: 'A', formato: 'pb', alias: { x: ['cod:A1'] } },
    b: { nombre: 'B', formato: 'pb', alias: { x: ['cod:A1'] } },
  });
  assert.equal(unico(indice, { tienda: 'x', nombre: 'Carta (A1)' }).motivo, 'ambigua');
});
