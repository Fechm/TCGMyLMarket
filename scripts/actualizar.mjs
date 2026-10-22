import { readFileSync } from 'node:fs';
import { calcular } from '../src/calcular.mjs';
import { crearIndice, emparejar } from '../src/emparejar.mjs';
import { escribirSellado, escribirSitio, FORMATOS } from '../src/escribir.mjs';
import { guardarDia, leerDias, registroDelDia, series } from '../src/historial.mjs';
import { crearCliente } from '../src/http.mjs';
import { LECTORES } from '../src/lectores/index.mjs';
import { leerConResguardo, resumirLectura } from '../src/resguardo.mjs';
import { armarSellado } from '../src/sellado.mjs';
import { categoriasALeer } from '../src/tiendas.mjs';

const leerJson = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const { propia, tiendas } = leerJson('../config/tiendas.json');
const tiendasSellado = leerJson('../config/tiendas-sellado.json');
const ediciones = leerJson('../config/ediciones.json');
const catalogo = leerJson('../config/sellado.json');

const DATOS = 'public/data';
const ULTIMOS = 'estado/ultimos';
const HISTORIAL = 'historial';
const ahora = new Date().toISOString();

async function leerTienda(tienda, prefijo = '') {
  const etiqueta = `${prefijo}${tienda.id}`;
  const inicio = Date.now();
  const lectura = await leerConResguardo({
    tienda,
    clave: etiqueta,
    dir: ULTIMOS,
    ahora,
    leer: () => LECTORES[tienda.lector].leer({ ...tienda, categorias: categoriasALeer(tienda, ediciones) }, crearCliente()),
  });
  if (lectura.error) console.error(`[${etiqueta}] falló: ${lectura.error}`);
  else console.log(`[${etiqueta}] ${lectura.listados.length} listados en ${Math.round((Date.now() - inicio) / 1000)} s`);
  return lectura;
}

async function leerSingles() {
  const lecturas = await Promise.all(tiendas.map((t) => leerTienda(t)));
  const deLaIra = lecturas.find((l) => l.tienda.id === propia);
  if (deLaIra.error) throw new Error(`[${propia}] ${deLaIra.error}`);
  return lecturas;
}

const [lecturas, lecturasSellado] = await Promise.all([
  leerSingles(),
  Promise.all(tiendasSellado.tiendas.map((t) => leerTienda(t, 'sellado-'))),
]);

const { emparejados, sinEmparejar } = emparejar(crearIndice(ediciones), lecturas.flatMap((l) => l.listados));
const { resumenes, comparativo, brechas } = calcular({ emparejados, sinEmparejar, ediciones, propia });
const sellado = armarSellado({ lecturas: lecturasSellado, catalogo, ediciones, propia: tiendasSellado.propia, generado: ahora });

guardarDia(HISTORIAL, ahora.slice(0, 10), registroDelDia(resumenes, propia));
const dias = leerDias(HISTORIAL, 90);
const seriesPorFormato = Object.fromEntries(
  FORMATOS.map((f) => [f, series(dias, comparativo.filter((c) => c.formato === f).map((c) => c.clave))]),
);

const meta = {
  generado: ahora,
  propia,
  tiendas: lecturas.map(resumirLectura),
  ediciones: Object.fromEntries(
    Object.entries(ediciones).map(([id, e]) => [id, { nombre: e.nombre, formato: e.formato, reciente: Boolean(e.reciente) }]),
  ),
  totales: { emparejados: emparejados.length, sinEmparejar: sinEmparejar.length, comparativo: comparativo.length, brechas: brechas.length },
  ...(sellado && { sellado: sellado.meta }),
};

escribirSitio(DATOS, { meta, comparativo, brechas, sinEmparejar, series: seriesPorFormato });
if (sellado) escribirSellado(DATOS, sellado.datos);
else console.error('[sellado] no disponible: La Ira sin listados de sellado');
console.log(JSON.stringify({ ...meta.totales, sellado: sellado?.meta.totales ?? null }));
