import * as cheerio from 'cheerio';
import { urlSegura } from '../url.mjs';

export function parsearListado(html, base, pagina = 1) {
  const $ = cheerio.load(html);
  const productos = $('div[data-bs=product][data-info]').toArray().map((elemento) => {
    const bloque = $(elemento);
    const enlace = bloque.find('a[title]').first();
    const precio = Number(bloque.find('.bs-collection__product-final-price').first().text().replace(/\D/g, '')) || 0;
    const agotado = /Agotado/i.test(bloque.find('.bs-collection__stock').text())
      || bloque.find('button[disabled]').length > 0;
    return {
      id: bloque.attr('data-info'),
      nombre: (enlace.attr('title') ?? '').replace(/\s+/g, ' ').trim(),
      url: urlSegura(enlace.attr('href'), base),
      imagen: urlSegura(bloque.find('img').first().attr('src'), base),
      precio,
      stock: !agotado && precio > 0,
    };
  });
  const siguiente = $('ul.pagination a.page-link[href]').toArray()
    .map((a) => urlSegura($(a).attr('href'), base))
    .some((url) => url && new URL(url).searchParams.get('page') === String(pagina + 1));
  return { productos, siguiente };
}

export async function leer(config, cliente) {
  const vistos = new Map();
  for (const categoria of config.categorias) {
    for (let pagina = 1; ; pagina++) {
      const html = await cliente.texto(`${config.url}/${categoria.ruta}?page=${pagina}`);
      const { productos, siguiente } = parsearListado(html, config.url, pagina);
      for (const producto of productos) {
        const previo = vistos.get(producto.id);
        vistos.set(producto.id, {
          tienda: config.id,
          ...producto,
          pistas: [...new Set([...(previo?.pistas ?? []), `ruta:${categoria.ruta}`])],
          formato: categoria.formato ?? previo?.formato ?? null,
        });
      }
      if (!productos.length || !siguiente) break;
    }
  }
  return [...vistos.values()];
}
