import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCliente, USER_AGENT } from '../src/http.mjs';

const respuesta = (status, cuerpo) =>
  new Response(typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo), { status });

test('envía el User-Agent del proyecto y devuelve JSON con headers', async () => {
  let recibido;
  const cliente = crearCliente({
    intervaloMs: 0,
    fetchImpl: async (url, opciones) => {
      recibido = opciones.headers['User-Agent'];
      return respuesta(200, { ok: 1 });
    },
  });
  const { datos, headers } = await cliente.json('https://x.cl/a');
  assert.deepEqual(datos, { ok: 1 });
  assert.equal(typeof headers.get, 'function');
  assert.equal(recibido, USER_AGENT);
});

test('reintenta ante un 500 y luego responde', async () => {
  let llamadas = 0;
  const cliente = crearCliente({
    intervaloMs: 0,
    pausaReintentoMs: 1,
    fetchImpl: async () => (++llamadas === 1 ? respuesta(500, 'x') : respuesta(200, 'hola')),
  });
  assert.equal(await cliente.texto('https://x.cl'), 'hola');
  assert.equal(llamadas, 2);
});

test('no reintenta un 404 y lanza error', async () => {
  let llamadas = 0;
  const cliente = crearCliente({
    intervaloMs: 0,
    pausaReintentoMs: 1,
    fetchImpl: async () => {
      llamadas++;
      return respuesta(404, 'no');
    },
  });
  await assert.rejects(cliente.texto('https://x.cl/nada'), /HTTP 404/);
  assert.equal(llamadas, 1);
});

test('se rinde después de los intentos configurados', async () => {
  let llamadas = 0;
  const cliente = crearCliente({
    intervaloMs: 0,
    intentos: 3,
    pausaReintentoMs: 1,
    fetchImpl: async () => {
      llamadas++;
      return respuesta(503, 'caído');
    },
  });
  await assert.rejects(cliente.texto('https://x.cl'), /HTTP 503/);
  assert.equal(llamadas, 3);
});

test('espera el intervalo entre peticiones', async () => {
  const cliente = crearCliente({ intervaloMs: 60, fetchImpl: async () => respuesta(200, 'ok') });
  const inicio = Date.now();
  await cliente.texto('https://x.cl/1');
  await cliente.texto('https://x.cl/2');
  assert.ok(Date.now() - inicio >= 55);
});
