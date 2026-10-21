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
  const origen = new URL(base).origin;
  const subcategorias = [...new Set($('section[id^="theme-section-category-subcategories-template"] a.theme-section__link[href]').toArray()
    .map((a) => new URL($(a).attr('href'), base))
    .filter((url) => url.origin === origen)
    .map((url) => url.pathname.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean))];
  return { productos, ultima, subcategorias };
}

async function recorrer(config, cliente, ruta, ancestros, formato, visitadas, vistos) {
  if (visitadas.has(ruta)) return;
  visitadas.add(ruta);
  const rutas = [...ancestros, ruta];
  const hijas = new Set();
  for (let pagina = 1; ; pagina++) {
    const html = await cliente.texto(`${config.url}/${ruta}?page=${pagina}`);
    const { productos, ultima, subcategorias } = parsearListado(html, config.url);
    for (const producto of productos) {
      const previo = vistos.get(producto.id);
      vistos.set(producto.id, {
        tienda: config.id,
        ...producto,
        pistas: [...new Set([...(previo?.pistas ?? []), ...rutas.map((r) => `ruta:${r}`)])],
        formato: formato ?? previo?.formato ?? null,
      });
    }
    for (const subcategoria of subcategorias) {
      if (subcategoria.startsWith(`${ruta}/`)) hijas.add(subcategoria);
    }
    if (!productos.length || pagina >= ultima) break;
  }
  for (const hija of hijas) await recorrer(config, cliente, hija, rutas, formato, visitadas, vistos);
}

export async function leer(config, cliente) {
  const vistos = new Map();
  const visitadas = new Set();
  for (const categoria of config.categorias) {
    await recorrer(config, cliente, categoria.ruta, [], categoria.formato, visitadas, vistos);
  }
  return [...vistos.values()];
}
