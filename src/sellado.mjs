import { comparar, mediana, preciosPorTienda } from './calcular.mjs';
import { plano } from './normalizar.mjs';

export const FACTOR_ATIPICO = 2.2;

const SINONIMOS = [
  [/\bloot box\b/g, 'lootbox'],
  [/\bmist?ery\b/g, 'mystery'],
  [/\bvolumen\b/g, 'vol'],
  [/\bpex?\b/g, 'primera era'],
  [/\bpbx?\b/g, 'primer bloque'],
  [/\blbf\b/g, 'leyendas bloque furia'],
  [/\bfx\b/g, 'furia extendido'],
  [/\bkit de batalla\b/g, 'kit batalla'],
  [/\baniverario\b/g, 'aniversario'],
];

const CANTIDADES = [
  /^(?:preventa )?(\d{1,2}) (?!sobres\b)/,
  /\bx (\d{1,2})\b/,
  /\b([3-9]) buy a box\b/,
  /\b(\d{1,2}) (?:unidades|display|displays|kits|cajas)\b/,
];

const MULTIPLES = /\b(?:duo pack|super pack|pack full|pack super full|pack todas)\b/;

export function normalizarSellado(nombre) {
  const base = plano(nombre)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/(?<=[a-z])(?=\d)|(?<=\d)(?=[a-z])/g, ' ');
  return SINONIMOS.reduce((texto, [patron, valor]) => texto.replace(patron, valor), base)
    .replace(/\s+/g, ' ')
    .trim();
}

function cantidadNormalizada(texto) {
  for (const patron of CANTIDADES) {
    const encontrado = texto.match(patron);
    if (encontrado) return Number(encontrado[1]);
  }
  return MULTIPLES.test(texto) ? 2 : 1;
}

export function cantidad(nombre) {
  return cantidadNormalizada(normalizarSellado(nombre));
}

const tiene = (texto, termino) => texto.includes(` ${normalizarSellado(termino)} `);

function calza(producto, texto) {
  return producto.incluye.every((t) => tiene(texto, t))
    && !(producto.excluye ?? []).some((t) => tiene(texto, t))
    && (!producto.alguno?.length || producto.alguno.some((t) => tiene(texto, t)));
}

export function identificar(catalogo, listado) {
  const texto = normalizarSellado(listado.nombre);
  if (!texto || cantidadNormalizada(texto) !== 1) return null;
  const candidatos = catalogo.filter((p) => calza(p, ` ${texto} `));
  return candidatos.length === 1 ? candidatos[0].id : null;
}

function agrupar(listados, catalogo) {
  const grupos = new Map();
  for (const listado of listados) {
    const id = identificar(catalogo, listado);
    if (!id) continue;
    if (grupos.has(id)) grupos.get(id).push(listado);
    else grupos.set(id, [listado]);
  }
  return grupos;
}

function marcarAtipicos(tiendas, propia) {
  const comparables = (t) => t.tienda !== propia && t.stock && !t.ambiguo;
  const precios = tiendas.filter(comparables).map((t) => t.precio);
  const tope = precios.length ? mediana(precios) * FACTOR_ATIPICO : Infinity;
  return tiendas.map(({ tienda, precio, stock, ambiguo, url }) => ({
    tienda, precio, stock, ambiguo, atipico: comparables({ tienda, stock, ambiguo }) && precio > tope, url,
  }));
}

function resumirSellado(producto, listados, ediciones, propia) {
  const tiendas = marcarAtipicos(preciosPorTienda(listados), propia);
  const otras = tiendas.filter((t) => t.tienda !== propia);
  const precios = otras.filter((t) => t.stock && !t.ambiguo && !t.atipico).map((t) => t.precio);
  const market = precios.length >= 2 ? mediana(precios) : null;
  const propiaTienda = tiendas.find((t) => t.tienda === propia);
  const precio = propiaTienda?.precio ?? null;
  const stock = Boolean(propiaTienda?.stock);
  const { diferencia, estado } = comparar(precio, market);
  return {
    id: producto.id,
    nombre: producto.nombre,
    edicion: producto.edicion,
    formato: ediciones[producto.edicion]?.formato ?? producto.formato,
    tipo: producto.tipo,
    reciente: Boolean(producto.reciente),
    precio,
    stock,
    url: propiaTienda?.url ?? null,
    market,
    referencia: precios.length === 1 ? precios[0] : null,
    min: precios.length ? Math.min(...precios) : null,
    max: precios.length ? Math.max(...precios) : null,
    nTiendas: precios.length,
    conStock: otras.filter((t) => t.stock).length,
    sugerido: market === null ? null : Math.round(market / 10) * 10,
    diferencia,
    estado: stock ? estado : null,
    tiendas,
    listada: Boolean(propiaTienda),
  };
}

const valor = (fila) => fila.market ?? fila.referencia ?? 0;

const ordenBrechas = (a, b) =>
  Number(b.reciente) - Number(a.reciente) || b.conStock - a.conStock || valor(b) - valor(a);

export function calcularSellado({ listados, catalogo, ediciones, propia }) {
  const porId = new Map(catalogo.map((p) => [p.id, p]));
  const filas = [...agrupar(listados, catalogo)].map(([id, grupo]) => resumirSellado(porId.get(id), grupo, ediciones, propia));
  const sinMarca = ({ listada, ...fila }) => fila;
  const comparativo = filas.filter((f) => f.listada).map(sinMarca);
  const brechas = filas.filter((f) => f.conStock > 0 && !f.stock).sort(ordenBrechas).map(sinMarca);
  return { comparativo, brechas };
}
