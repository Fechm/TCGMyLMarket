const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const pesos = (v) => (v === null || v === undefined ? '—' : clp.format(v));
const porcentaje = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
const $ = (selector) => document.querySelector(selector);
const vacio = (v) => v === null || v === undefined;
const esWeb = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
const MAXIMO_FILAS = 500;

const cache = new Map();
const estado = { vista: 'comparativo', ordenes: { comparativo: { campo: 'diferencia', asc: true }, brechas: null } };
let meta;
let turno = 0;

function cargar(nombre) {
  if (!cache.has(nombre)) {
    cache.set(nombre, fetch(`data/${nombre}`).then((r) => {
      if (!r.ok) throw new Error(`${nombre}: HTTP ${r.status}`);
      return r.json();
    }).catch((error) => {
      cache.delete(nombre);
      throw error;
    }));
  }
  return cache.get(nombre);
}

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const nombreTienda = (id) => meta.tiendas.find((t) => t.id === id)?.nombre ?? id;
const nombreEdicion = (id) => meta.ediciones[id]?.nombre ?? id;

function llenarEdiciones() {
  const formato = $('#formato').value;
  const opciones = Object.entries(meta.ediciones)
    .filter(([, e]) => e.formato === formato)
    .sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  $('#edicion').innerHTML = '<option value="">Todas las ediciones</option>'
    + opciones.map(([id, e]) => `<option value="${id}">${escapar(e.nombre)}</option>`).join('');
}

function filtrar(filas) {
  const edicion = $('#edicion').value;
  const filtroEstado = estado.vista === 'comparativo' ? $('#estado').value : '';
  const texto = $('#buscar').value.trim().toLowerCase();
  return filas.filter((f) => (!edicion || f.edicion === edicion)
    && (!filtroEstado || (filtroEstado === 'sin-market' ? f.market === null : f.estado === filtroEstado))
    && (!texto || f.nombre.toLowerCase().includes(texto)));
}

function ordenar(filas, orden) {
  if (!orden) return filas;
  const { campo, asc } = orden;
  return [...filas].sort((a, b) => {
    const x = a[campo];
    const y = b[campo];
    if (vacio(x) && vacio(y)) return 0;
    if (vacio(x)) return 1;
    if (vacio(y)) return -1;
    const r = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return asc ? r : -r;
  });
}

function tabla(columnas, filas, fila) {
  const orden = estado.ordenes[estado.vista];
  const cabecera = columnas
    .map(([campo, titulo]) => `<th data-campo="${campo}">${titulo}${orden?.campo === campo ? (orden.asc ? ' ▲' : ' ▼') : ''}</th>`)
    .join('');
  const pie = filas.length > MAXIMO_FILAS ? `<p class="nota">Mostrando ${MAXIMO_FILAS}. Filtra para ver más.</p>` : '';
  return `<table><thead><tr>${cabecera}</tr></thead><tbody>${filas.slice(0, MAXIMO_FILAS).map(fila).join('')}</tbody></table>${pie}`;
}

function conectar(filas) {
  $('#tabla').querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
    const campo = th.dataset.campo;
    const actual = estado.ordenes[estado.vista];
    estado.ordenes[estado.vista] = { campo, asc: actual?.campo === campo ? !actual.asc : true };
    render();
  }));
  $('#tabla').querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => abrirDetalle(filas[Number(tr.dataset.i)])));
}

function celdaMarket(f) {
  if (f.market !== null) return pesos(f.market);
  if (f.referencia !== null) return `<span title="Solo una tienda con stock">${pesos(f.referencia)}*</span>`;
  return '—';
}

function subtitulo(f) {
  const partes = [nombreEdicion(f.edicion)];
  if (f.variante !== 'normal') partes.push(f.variante);
  if (f.stock === false) partes.push('agotada');
  return partes.map(escapar).join(' · ');
}

async function renderComparativo() {
  const propio = ++turno;
  const filas = await cargar(`cartas-${$('#formato').value}.json`);
  if (propio !== turno) return;
  const visibles = ordenar(filtrar(filas), estado.ordenes.comparativo);
  $('#resumen').textContent = `${visibles.length} de ${filas.length} singles de La Ira. * = solo una tienda con stock.`;
  $('#tabla').innerHTML = tabla(
    [['nombre', 'Carta'], ['precio', 'La Ira'], ['market', 'Market'], ['diferencia', 'Dif.'], ['nTiendas', 'Tiendas'], ['sugerido', 'Sugerido']],
    visibles,
    (f, i) => `<tr data-i="${i}" class="${f.estado ?? ''}">
      <td>${escapar(f.nombre)}<small>${subtitulo(f)}</small></td>
      <td>${pesos(f.precio)}</td>
      <td>${celdaMarket(f)}</td>
      <td>${porcentaje(f.diferencia)}</td>
      <td>${f.nTiendas}</td>
      <td>${pesos(f.sugerido)}</td>
    </tr>`,
  );
  conectar(visibles);
}

async function renderBrechas() {
  const propio = ++turno;
  const todas = await cargar('brechas.json');
  if (propio !== turno) return;
  const filas = filtrar(todas.filter((b) => b.formato === $('#formato').value));
  const visibles = ordenar(filas, estado.ordenes.brechas);
  $('#resumen').textContent = `${visibles.length} cartas con stock en otras tiendas que La Ira no tiene con stock.`;
  $('#tabla').innerHTML = tabla(
    [['nombre', 'Carta'], ['market', 'Market'], ['conStock', 'Tiendas con stock'], ['sugerido', 'Sugerido']],
    visibles,
    (f, i) => `<tr data-i="${i}">
      <td>${escapar(f.nombre)}${f.reciente ? '<span class="etiqueta reciente">reciente</span>' : ''}${f.otraVersion ? '<span class="etiqueta">La Ira tiene otra versión</span>' : ''}<small>${subtitulo(f)}</small></td>
      <td>${celdaMarket(f)}</td>
      <td>${f.conStock}</td>
      <td>${pesos(f.sugerido)}</td>
    </tr>`,
  );
  conectar(visibles);
}

async function renderSinEmparejar() {
  const propio = ++turno;
  const grupos = await cargar('sin-emparejar.json');
  if (propio !== turno) return;
  $('#resumen').textContent = `${meta.totales.sinEmparejar} listados sin emparejar, agrupados por pistas. Sirven para completar config/ediciones.json.`;
  $('#tabla').innerHTML = `<table><thead><tr><th>Tienda</th><th>Motivo</th><th>Pistas</th><th>Cantidad</th><th>Ejemplos</th></tr></thead><tbody>${grupos.map((g) => `<tr>
    <td>${escapar(nombreTienda(g.tienda))}</td><td>${g.motivo}</td><td><code>${escapar(g.pistas.join(' '))}</code></td>
    <td>${g.cantidad}</td><td>${escapar(g.ejemplos.join(' · '))}</td></tr>`).join('')}</tbody></table>`;
}

function grafico(puntos) {
  if (!puntos || puntos.length < 2) return '<p class="nota">Aún no hay historial suficiente para graficar.</p>';
  const ancho = 320;
  const alto = 120;
  const margen = 8;
  const valores = puntos.flatMap(([, market, propio]) => [market, propio]).filter((v) => v !== null);
  if (!valores.length) return '';
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const x = (i) => margen + (i * (ancho - 2 * margen)) / (puntos.length - 1);
  const y = (v) => alto - margen - ((v - min) * (alto - 2 * margen)) / (max - min || 1);
  const linea = (indice, clase) => `<polyline class="${clase}" fill="none" points="${puntos
    .map((p, i) => (p[indice] === null ? null : `${x(i).toFixed(1)},${y(p[indice]).toFixed(1)}`))
    .filter(Boolean)
    .join(' ')}"/>`;
  return `<svg viewBox="0 0 ${ancho} ${alto}" class="grafico" role="img" aria-label="Historial de precio">${linea(1, 'market')}${linea(2, 'propia')}</svg>
    <p class="leyenda nota"><span class="market">■ Market</span> <span class="propia">■ La Ira</span> · ${puntos[0][0]} a ${puntos.at(-1)[0]}</p>`;
}

function enlaceTienda(url, nombre) {
  return esWeb(url) ? `<a href="${escapar(url)}" target="_blank" rel="noopener">${escapar(nombre)}</a>` : escapar(nombre);
}

async function abrirDetalle(f) {
  const series = await cargar(`series-${f.formato}.json`);
  const tiendas = [...f.tiendas].sort((a, b) => (a.precio ?? Number.MAX_SAFE_INTEGER) - (b.precio ?? Number.MAX_SAFE_INTEGER));
  $('#detalle-contenido').innerHTML = `
    ${esWeb(f.imagen) ? `<img src="${escapar(f.imagen)}" alt="" loading="lazy">` : ''}
    <h2>${escapar(f.nombre)}</h2>
    <p class="nota">${subtitulo(f)}</p>
    <p>Market: <strong>${celdaMarket(f)}</strong> · Sugerido: <strong>${pesos(f.sugerido)}</strong>${vacio(f.min) || vacio(f.max) ? '' : ` · Rango: <strong>${pesos(f.min)} – ${pesos(f.max)}</strong>`}</p>
    <table><thead><tr><th>Tienda</th><th>Precio</th><th>Stock</th></tr></thead><tbody>
      ${tiendas.map((t) => `<tr><td>${enlaceTienda(t.url, nombreTienda(t.tienda))}</td>
        <td>${t.ambiguo ? 'varios precios' : pesos(t.precio)}</td><td>${t.stock ? 'sí' : 'no'}</td></tr>`).join('')}
    </tbody></table>
    ${grafico(series[f.clave])}`;
  $('#detalle').showModal();
}

function renderPie() {
  const tiendas = meta.tiendas.map((t) => {
    const viejo = t.reutilizado ? ` <em>(datos del ${t.ultimaLectura ? new Date(t.ultimaLectura).toLocaleDateString('es-CL') : '—'})</em>` : '';
    return `${enlaceTienda(t.url, t.nombre)}: ${t.listados} (${t.conStock} con stock)${viejo}`;
  });
  $('#pie').innerHTML = `Actualizado ${new Date(meta.generado).toLocaleString('es-CL')}. ${tiendas.join(' · ')}`;
}

async function render() {
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('activa', b.dataset.vista === estado.vista));
  $('#filtros').hidden = estado.vista === 'sin-emparejar';
  $('#estado').hidden = estado.vista !== 'comparativo';
  if (estado.vista === 'comparativo') await renderComparativo();
  else if (estado.vista === 'brechas') await renderBrechas();
  else await renderSinEmparejar();
}

async function iniciar() {
  meta = await cargar('meta.json');
  llenarEdiciones();
  document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => {
    estado.vista = b.dataset.vista;
    render();
  }));
  $('#formato').addEventListener('change', () => {
    llenarEdiciones();
    render();
  });
  $('#edicion').addEventListener('change', render);
  $('#estado').addEventListener('change', render);
  $('#buscar').addEventListener('input', render);
  renderPie();
  await render();
}

iniciar().catch((error) => {
  console.error(error);
  $('#resumen').textContent = 'No se pudieron cargar los datos.';
});
