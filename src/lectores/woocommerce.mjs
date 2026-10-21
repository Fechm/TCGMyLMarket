import { decodificar, plano } from '../normalizar.mjs';

function agregar(vistos, tienda, categoria, producto) {
  const id = String(producto.id);
  const previo = vistos.get(id);
  const pistas = new Set(previo?.pistas);
  pistas.add(`cat:${categoria.id}`);
  for (const c of producto.categories ?? []) pistas.add(`cat:${c.id}`);
  const precio = Math.round(Number(producto.prices?.price ?? 0)) || 0;
  vistos.set(id, {
    tienda,
    id,
    nombre: decodificar(producto.name),
    precio,
    stock: Boolean(producto.is_in_stock) && precio > 0,
    url: producto.permalink,
    imagen: producto.images?.[0]?.thumbnail ?? producto.images?.[0]?.src ?? null,
    pistas: [...pistas],
    formato: categoria.formato ?? previo?.formato ?? null,
  });
}

export async function leer(config, cliente) {
  const vistos = new Map();
  const excluir = config.excluir ? new RegExp(config.excluir) : null;
  for (const categoria of config.categorias) {
    for (let pagina = 1; ; pagina++) {
      const url = `${config.url}${config.ruta}?category=${categoria.id}&per_page=100&page=${pagina}`;
      const { datos, headers } = await cliente.json(url);
      for (const producto of datos) {
        if (excluir?.test(plano(producto.name))) continue;
        agregar(vistos, config.id, categoria, producto);
      }
      if (!datos.length || pagina >= Number(headers.get('x-wp-totalpages') ?? 1)) break;
    }
  }
  return [...vistos.values()];
}
