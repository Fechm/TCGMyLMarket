import { urlSegura } from '../url.mjs';

export const PRECIO_MAXIMO = 1000000;

export async function leer(config, cliente) {
  const listados = [];
  const ignorados = new Set(config.tagsIgnorados ?? []);
  for (let pagina = 1; ; pagina++) {
    const url = `${config.url}/collections/${config.coleccion}/products.json?limit=250&page=${pagina}`;
    const { datos } = await cliente.json(url);
    const productos = datos.products ?? [];
    for (const producto of productos) {
      const variante = producto.variants?.[0];
      const bruto = Math.round(Number(variante?.price)) || 0;
      const disponible = Boolean(variante?.available) && bruto <= PRECIO_MAXIMO;
      const precio = disponible ? bruto : 0;
      listados.push({
        tienda: config.id,
        id: String(producto.id),
        nombre: producto.title,
        precio,
        stock: disponible && precio > 0,
        url: urlSegura(`${config.url}/products/${producto.handle}`),
        imagen: urlSegura(producto.images?.[0]?.src, config.url),
        pistas: (producto.tags ?? []).filter((t) => !ignorados.has(t)).map((t) => `tag:${t}`),
        formato: null,
      });
    }
    if (productos.length < 250) break;
  }
  return listados;
}
