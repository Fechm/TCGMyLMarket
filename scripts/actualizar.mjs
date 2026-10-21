import { readFileSync } from 'node:fs';
import { calcular } from '../src/calcular.mjs';
import { crearIndice, emparejar } from '../src/emparejar.mjs';
import { escribirSitio, FORMATOS } from '../src/escribir.mjs';
import { guardarDia, leerDias, registroDelDia, series } from '../src/historial.mjs';
import { crearCliente } from '../src/http.mjs';
import { LECTORES } from '../src/lectores/index.mjs';
import { guardarUltimos, leerUltimos, validar } from '../src/resguardo.mjs';
import { categoriasALeer } from '../src/tiendas.mjs';

const leerJson = (ruta) => JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8'));
const { propia, tiendas } = leerJson('../config/tiendas.json');
const ediciones = leerJson('../config/ediciones.json');

const DATOS = 'public/data';
const ULTIMOS = 'estado/ultimos';
const HISTORIAL = 'historial';
const ahora = new Date().toISOString();

async function leerTienda(tienda) {
  const anteriores = leerUltimos(ULTIMOS, tienda.id);
  try {
    const inicio = Date.now();
    const config = { ...tienda, categorias: categoriasALeer(tienda, ediciones) };
    const listados = await LECTORES[tienda.lector].leer(config, crearCliente());
    const problema = validar(listados, anteriores?.listados);
    if (problema) throw new Error(problema);
    guardarUltimos(ULTIMOS, tienda.id, ahora, listados);
    console.log(`[${tienda.id}] ${listados.length} listados en ${Math.round((Date.now() - inicio) / 1000)} s`);
    return { tienda, listados, ultimaLectura: ahora, reutilizado: false, error: null };
  } catch (error) {
    console.error(`[${tienda.id}] falló: ${error.message}`);
    if (tienda.id === propia) throw error;
    return { tienda, listados: anteriores?.listados ?? [], ultimaLectura: anteriores?.fecha ?? null, reutilizado: true, error: error.message };
  }
}

const lecturas = await Promise.all(tiendas.map(leerTienda));
const { emparejados, sinEmparejar } = emparejar(crearIndice(ediciones), lecturas.flatMap((l) => l.listados));
const { resumenes, comparativo, brechas } = calcular({ emparejados, sinEmparejar, ediciones, propia });

guardarDia(HISTORIAL, ahora.slice(0, 10), registroDelDia(resumenes, propia));
const dias = leerDias(HISTORIAL, 90);
const seriesPorFormato = Object.fromEntries(
  FORMATOS.map((f) => [f, series(dias, comparativo.filter((c) => c.formato === f).map((c) => c.clave))]),
);

const meta = {
  generado: ahora,
  propia,
  tiendas: lecturas.map((l) => ({
    id: l.tienda.id,
    nombre: l.tienda.nombre,
    url: l.tienda.url,
    listados: l.listados.length,
    conStock: l.listados.filter((x) => x.stock).length,
    ultimaLectura: l.ultimaLectura,
    reutilizado: l.reutilizado,
    error: l.error,
  })),
  ediciones: Object.fromEntries(
    Object.entries(ediciones).map(([id, e]) => [id, { nombre: e.nombre, formato: e.formato, reciente: Boolean(e.reciente) }]),
  ),
  totales: { emparejados: emparejados.length, sinEmparejar: sinEmparejar.length, comparativo: comparativo.length, brechas: brechas.length },
};

escribirSitio(DATOS, { meta, comparativo, brechas, sinEmparejar, series: seriesPorFormato });
console.log(JSON.stringify(meta.totales));
