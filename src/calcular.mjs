export const UMBRAL = 0.15;
export const MINIMO_TIENDAS = 2;

export function mediana(valores) {
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : Math.round((orden[medio - 1] + orden[medio]) / 2);
}

export function comparar(precio, market) {
  if (market === null || !precio) return { diferencia: null, estado: null };
  const exacta = (precio - market) / market;
  const estado = exacta <= -UMBRAL ? 'bajo' : exacta >= UMBRAL ? 'sobre' : 'en-linea';
  return { diferencia: Math.round(exacta * 1000) / 1000, estado };
}

function preciosPorTienda(listados) {
  const porTienda = new Map();
  for (const listado of listados) {
    const grupo = porTienda.get(listado.tienda);
    if (grupo) grupo.push(listado);
    else porTienda.set(listado.tienda, [listado]);
  }
  return [...porTienda].map(([tienda, propios]) => {
    const conStock = propios.filter((l) => l.stock);
    const precios = [...new Set(conStock.map((l) => l.precio))];
    const precio = precios.length > 1 ? null : precios.length === 1 ? precios[0] : Math.min(...propios.map((l) => l.precio)) || null;
    return { tienda, stock: conStock.length > 0, ambiguo: precios.length > 1, precio, url: (conStock[0] ?? propios[0]).url };
  });
}

export function resumir(clave, listados, propia) {
  const tiendas = preciosPorTienda(listados);
  const otras = tiendas.filter((t) => t.tienda !== propia);
  const precios = otras.filter((t) => t.stock && !t.ambiguo).map((t) => t.precio);
  const market = precios.length >= MINIMO_TIENDAS ? mediana(precios) : null;
  const muestra = listados.find((l) => l.tienda === propia) ?? listados[0];
  return {
    clave,
    nombre: muestra.nombre,
    nombreClave: muestra.nombreClave,
    edicion: muestra.edicion,
    variante: muestra.variante,
    imagen: listados.find((l) => l.imagen)?.imagen ?? null,
    tiendas,
    nTiendas: precios.length,
    conStock: otras.filter((t) => t.stock).length,
    market,
    referencia: precios.length === 1 ? precios[0] : null,
    min: precios.length ? Math.min(...precios) : null,
    max: precios.length ? Math.max(...precios) : null,
    sugerido: market === null ? null : Math.round(market / 100) * 100,
  };
}

export function calcular({ emparejados, sinEmparejar, ediciones, propia }) {
  const grupos = new Map();
  for (const listado of emparejados) {
    const grupo = grupos.get(listado.clave);
    if (grupo) grupo.push(listado);
    else grupos.set(listado.clave, [listado]);
  }
  const resumenes = [...grupos].map(([clave, listados]) => resumir(clave, listados, propia));
  const porClave = new Map(resumenes.map((r) => [r.clave, r]));

  const comparativo = emparejados
    .filter((l) => l.tienda === propia)
    .map((l) => {
      const r = porClave.get(l.clave);
      const { diferencia, estado } = comparar(l.precio, r.market);
      return {
        id: l.id, nombre: l.nombre, url: l.url, imagen: l.imagen, precio: l.precio, stock: l.stock,
        clave: l.clave, edicion: l.edicion, formato: ediciones[l.edicion].formato, variante: l.variante,
        market: r.market, referencia: r.referencia, min: r.min, max: r.max, nTiendas: r.nTiendas,
        sugerido: r.sugerido, tiendas: r.tiendas, diferencia, estado: l.stock ? estado : null,
      };
    });

  const propiasConStock = new Set(
    [...emparejados, ...sinEmparejar]
      .filter((l) => l.tienda === propia && l.stock)
      .map((l) => `${l.nombreClave}|${l.variante}`),
  );
  const valor = (r) => r.market ?? r.referencia ?? 0;
  const brechas = resumenes
    .filter((r) => r.conStock > 0 && !r.tiendas.some((t) => t.tienda === propia && t.stock))
    .map((r) => ({
      ...r,
      formato: ediciones[r.edicion].formato,
      reciente: Boolean(ediciones[r.edicion].reciente),
      otraVersion: propiasConStock.has(`${r.nombreClave}|${r.variante}`),
    }))
    .sort((a, b) => Number(b.reciente) - Number(a.reciente) || b.conStock - a.conStock || valor(b) - valor(a));

  return { resumenes, comparativo, brechas };
}
