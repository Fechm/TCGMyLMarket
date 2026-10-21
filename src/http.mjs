export const USER_AGENT = 'TCGMyLMarket/1.0 (+https://github.com/Fechm/TCGMyLMarket)';

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

export function crearCliente({
  intervaloMs = 1000,
  intentos = 3,
  pausaReintentoMs = 2000,
  timeoutMs = 30000,
  fetchImpl = fetch,
} = {}) {
  let siguiente = 0;

  async function pedir(url) {
    const pausa = siguiente - Date.now();
    if (pausa > 0) await esperar(pausa);
    siguiente = Date.now() + intervaloMs;
    for (let intento = 1; ; intento++) {
      try {
        const respuesta = await fetchImpl(url, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if ((respuesta.status >= 500 || respuesta.status === 429) && intento < intentos) {
          const segundos = Number(respuesta.headers.get('retry-after'));
          const pedida = Number.isFinite(segundos) ? segundos * 1000 : 0;
          await esperar(Math.min(Math.max(pedida, pausaReintentoMs * intento), 60000));
          continue;
        }
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status} ${url}`);
        return respuesta;
      } catch (error) {
        if (intento >= intentos || /HTTP 4\d\d/.test(error.message)) throw error;
        await esperar(pausaReintentoMs * intento);
      }
    }
  }

  return {
    async json(url) {
      const respuesta = await pedir(url);
      return { datos: await respuesta.json(), headers: respuesta.headers };
    },
    async texto(url) {
      return (await pedir(url)).text();
    },
  };
}
