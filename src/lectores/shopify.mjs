import { urlSegura } from '../url.mjs';

export const PRECIO_MAXIMO = 1000000;

function listado(config, producto, variante, pistas, id, nombre) {
  const bruto = Math.round(Number(variante?.price)) || 0;
  const disponible = Boolean(variante?.available) && bruto <= PRECIO_MAXIMO;
  const precio = disponible ? bruto : 0;
  return {
    tienda: config.id,
    id,
    nombre,
    precio,
    stock: disponible && precio > 0,
    url: urlSegura(`${config.url}/products/${producto.handle}`),
    imagen: urlSegura(producto.images?.[0]?.src, config.url),
    pistas,
    formato: null,
  };
}

export async function leer(config, cliente) {
  const listados = [];
  const ignorados = new Set(config.tagsIgnorados ?? []);
  for (let pagina = 1; ; pagina++) {
    const url = `${config.url}/collections/${config.coleccion}/products.json?limit=250&page=${pagina}`;
    const { datos } = await cliente.json(url);
    const productos = datos.products ?? [];
    for (const producto of productos) {
      const pistas = (producto.tags ?? []).filter((t) => !ignorados.has(t)).map((t) => `tag:${t}`);
      if (!config.expandirVariantes) {
        listados.push(listado(config, producto, producto.variants?.[0], pistas, String(producto.id), producto.title));
        continue;
      }
      for (const variante of producto.variants ?? []) {
        const nombre = variante.title === 'Default Title' ? producto.title : `${producto.title} - ${variante.title}`;
        listados.push(listado(config, producto, variante, [...pistas], `${producto.id}:${variante.id}`, nombre));
      }
    }
    if (productos.length < 250) break;
  }
  return listados;
}
