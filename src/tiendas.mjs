export function categoriasALeer(tienda, ediciones) {
  const categorias = [...(tienda.categorias ?? [])];
  if (!tienda.leerAlias) return categorias;
  const esRuta = tienda.lector === 'jumpseller';
  const prefijo = esRuta ? 'ruta:' : 'cat:';
  const vistas = new Set(categorias.map((c) => String(esRuta ? c.ruta : c.id)));
  for (const edicion of Object.values(ediciones)) {
    for (const alias of edicion.alias?.[tienda.id] ?? []) {
      if (!alias.startsWith(prefijo)) continue;
      const valor = alias.slice(prefijo.length);
      if (vistas.has(valor)) continue;
      vistas.add(valor);
      categorias.push(esRuta ? { ruta: valor, formato: edicion.formato } : { id: Number(valor), formato: edicion.formato });
    }
  }
  return categorias;
}
