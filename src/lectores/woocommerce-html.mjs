import * as cheerio from 'cheerio';
import { urlSegura } from '../url.mjs';

function leerPrecio($, bloque) {
  const precio = bloque.find('.price').first().clone();
  precio.find('del, .screen-reader-text').remove();
  const montos = precio.find('bdi').toArray()
    .map((bdi) => Number($(bdi).text().replace(/\D/g, '')))
    .filter((monto) => monto > 0);
  return montos.length ? Math.min(...montos) : 0;
}

export function parsearListado(html, base) {
  const $ = cheerio.load(html);
  const productos = $('div.product-grid-item[data-id]').toArray().map((elemento) => {
    const bloque = $(elemento);
    const enlace = bloque.find('a.product-image-link').first();
    const titulo = bloque.find('.wd-entities-title a').first();
    const imagen = bloque.find('img').first();
    const precio = leerPrecio($, bloque);
    const categorias = (bloque.attr('class') ?? '').split(/\s+/)
      .filter((clase) => clase.startsWith('product_cat-'))
      .map((clase) => `cat:${clase.slice('product_cat-'.length)}`);
    return {
      id: bloque.attr('data-id'),
      nombre: (enlace.attr('aria-label') || titulo.text()).replace(/\s+/g, ' ').trim(),
      url: urlSegura(enlace.attr('href') ?? titulo.attr('href'), base),
      imagen: urlSegura(imagen.attr('data-src'), base) ?? urlSegura(imagen.attr('src'), base),
      precio,
      stock: bloque.hasClass('instock') && precio > 0,
      categorias,
    };
  });
  const siguiente = $('a.next.page-numbers').length > 0;
  return { productos, siguiente };
}

export async function leer(config, cliente) {
  const vistos = new Map();
  for (const categoria of config.categorias) {
    for (let pagina = 1; ; pagina++) {
      const url = pagina === 1 ? `${config.url}/${categoria.ruta}/` : `${config.url}/${categoria.ruta}/page/${pagina}/`;
      const { productos, siguiente } = parsearListado(await cliente.texto(url), config.url);
      for (const { categorias, ...producto } of productos) {
        const previo = vistos.get(producto.id);
        vistos.set(producto.id, {
          tienda: config.id,
          ...producto,
          pistas: [...new Set([...(previo?.pistas ?? []), `ruta:${categoria.ruta}`, ...categorias])],
          formato: categoria.formato ?? previo?.formato ?? null,
        });
      }
      if (!productos.length || !siguiente) break;
    }
  }
  return [...vistos.values()];
}
