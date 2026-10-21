import { test } from 'node:test';
import assert from 'node:assert/strict';
import { urlSegura } from '../src/url.mjs';

test('urlSegura resuelve rutas relativas y conserva http y https', () => {
  assert.equal(urlSegura('/carta', 'https://tienda.cl'), 'https://tienda.cl/carta');
  assert.equal(urlSegura('http://tienda.cl/a'), 'http://tienda.cl/a');
  assert.equal(urlSegura('//cdn.tienda.cl/a.png', 'https://tienda.cl'), 'https://cdn.tienda.cl/a.png');
});

test('urlSegura descarta otros esquemas', () => {
  assert.equal(urlSegura('javascript:alert(1)', 'https://tienda.cl'), null);
  assert.equal(urlSegura('JavaScript:alert(1)'), null);
  assert.equal(urlSegura('data:text/html,hola'), null);
  assert.equal(urlSegura('ftp://tienda.cl/a'), null);
});

test('urlSegura devuelve null con valores inválidos o vacíos', () => {
  assert.equal(urlSegura('no es url'), null);
  assert.equal(urlSegura('http://'), null);
  assert.equal(urlSegura(undefined), null);
  assert.equal(urlSegura(null, 'https://tienda.cl'), null);
  assert.equal(urlSegura(''), null);
});
