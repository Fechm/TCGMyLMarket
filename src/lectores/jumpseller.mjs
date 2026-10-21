import * as cheerio from 'cheerio';

export function parsearListado(html, base) {
  const $ = cheerio.load(html);
  const productos = $('article.product-block[data-product-id]').toArray().map((elemento) => {
    const bloque = $(elemento);
    const enlace = bloque.find('a.product-block__name').first();
    const nuevo = bloque.find('.product-block__price--new').first();
    const precioElemento = nuevo.length ? nuevo : bloque.find('.product-block__price').not('.product-block__price--old').first();
    const precio = Number(precioElemento.text().replace(/\D/g, '')) || 0;
    const agotado = bloque.find('.product-block__label--status').length > 0;
    const comprable = bloque.find('form.product-block__form').length > 0;
    return {
      id: bloque.attr('data-product-id'),
      nombre: enlace.text().replace(/\s+/g, ' ').trim(),
      url: new URL(enlace.attr('href'), base).href,
      imagen: bloque.find('img.product-block__image').attr('src') ?? null,
      precio,
      stock: !agotado && comprable && precio > 0,
    };
  });
  const ultima = Number($('ul.pager li.last a').attr('href')?.match(/page=(\d+)/)?.[1] ?? 1);
  return { productos, ultima };
}

export async function leer(config, cliente) {
  const vistos = new Map();
  for (const categoria of config.categorias) {
    for (let pagina = 1; ; pagina++) {
      const html = await cliente.texto(`${config.url}/${categoria.ruta}?page=${pagina}`);
      const { productos, ultima } = parsearListado(html, config.url);
      for (const producto of productos) {
        const previo = vistos.get(producto.id);
        vistos.set(producto.id, {
          tienda: config.id,
          ...producto,
          pistas: [...new Set([...(previo?.pistas ?? []), `ruta:${categoria.ruta}`])],
          formato: categoria.formato ?? previo?.formato ?? null,
        });
      }
      if (!productos.length || pagina >= ultima) break;
    }
  }
  return [...vistos.values()];
}
