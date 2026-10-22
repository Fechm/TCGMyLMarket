const clp = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
const pesos = (v) => (v === null || v === undefined ? '—' : clp.format(v));
const porcentaje = (v) => (v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
const $ = (selector) => document.querySelector(selector);
const vacio = (v) => v === null || v === undefined;
const esWeb = (v) => typeof v === 'string' && /^https?:\/\//i.test(v);
const MAXIMO_FILAS = 500;
const VISTA_INICIAL = 'singles/comparativo';
const FILTROS = ['formato', 'edicion', 'estado', 'formato-sellado', 'tipo', 'buscar'];
const FILTROS_SELLADO = ['formato-sellado', 'tipo', 'buscar'];
const TIPOS = { display: 'display', sobre: 'sobre', kit: 'kit', mazo: 'mazo', especial: 'especial', toolkit: 'toolkit', lootbox: 'lootbox', coleccion: 'colección' };
const SELLADO_PRONTO = 'El comparativo de sellado estará disponible pronto.';
const VISTAS = {
  'singles/comparativo': {
    titulo: 'Singles · Comparativo',
    descripcion: 'Precio de cada single de La Ira frente al market chileno, con un precio sugerido.',
    filtros: ['formato', 'edicion', 'estado', 'buscar'],
    buscar: 'Buscar carta…',
    render: renderComparativo,
  },
  'singles/brechas': {
    titulo: 'Singles · Brechas',
    descripcion: 'Cartas que otras tiendas tienen con stock y La Ira no: oportunidades de surtido.',
    filtros: ['formato', 'edicion', 'buscar'],
    buscar: 'Buscar carta…',
    render: renderBrechas,
  },
  'sellado/comparativo': {
    titulo: 'Sellado · Comparativo',
    descripcion: 'Precio de sobres, displays y mazos sellados de La Ira frente al market chileno.',
    filtros: FILTROS_SELLADO,
    buscar: 'Buscar producto…',
    render: () => renderSellado('comparativo'),
  },
  'sellado/brechas': {
    titulo: 'Sellado · Brechas',
    descripcion: 'Productos sellados que otras tiendas tienen con stock y La Ira no.',
    filtros: FILTROS_SELLADO,
    buscar: 'Buscar producto…',
    render: () => renderSellado('brechas'),
  },
  'diagnostico/sin-emparejar': {
    titulo: 'Diagnóstico · Sin emparejar',
    descripcion: 'Listados de otras tiendas que no se pudieron asociar a una carta conocida.',
    filtros: [],
    render: renderSinEmparejar,
  },
};

const cache = new Map();
const estado = {
  vista: VISTA_INICIAL,
  ordenes: { 'singles/comparativo': { campo: 'diferencia', asc: true }, 'singles/brechas': null, 'sellado/comparativo': null, 'sellado/brechas': null },
};
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
const nombreTiendaSellado = (id) => meta.sellado?.tiendas.find((t) => t.id === id)?.nombre ?? id;
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
  const filtroEstado = VISTAS[estado.vista].filtros.includes('estado') ? $('#estado').value : '';
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

function conectar(filas, alAbrir = abrirDetalle) {
  $('#tabla').querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
    const campo = th.dataset.campo;
    const actual = estado.ordenes[estado.vista];
    estado.ordenes[estado.vista] = { campo, asc: actual?.campo === campo ? !actual.asc : true };
    refrescar();
  }));
  if (!alAbrir) return;
  $('#tabla').querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => alAbrir(filas[Number(tr.dataset.i)]).catch(fallar)));
}

function mostrarVacio(mensaje) {
  $('#resumen').textContent = '';
  $('#tabla').innerHTML = `<p class="vacio">${escapar(mensaje)}</p>`;
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
  const visibles = ordenar(filtrar(filas), estado.ordenes['singles/comparativo']);
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
  const visibles = ordenar(filas, estado.ordenes['singles/brechas']);
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

async function cargarSellado() {
  if (!meta.sellado) return null;
  try {
    return await cargar('sellado.json');
  } catch {
    return null;
  }
}

function subtituloSellado(f) {
  const partes = [nombreEdicion(f.edicion), TIPOS[f.tipo] ?? f.tipo];
  if (f.stock === false && f.precio !== null) partes.push('agotado');
  return partes.map(escapar).join(' · ');
}

const COLUMNAS_SELLADO = {
  comparativo: {
    columnas: [['nombre', 'Producto'], ['precio', 'La Ira'], ['market', 'Market'], ['diferencia', 'Dif.'], ['nTiendas', 'Tiendas'], ['sugerido', 'Sugerido']],
    resumen: (n, total) => `${n} de ${total} productos sellados de La Ira. * = solo una tienda con stock.`,
    fila: (f, i) => `<tr data-i="${i}" class="${escapar(f.estado ?? '')}">
      <td>${escapar(f.nombre)}<small>${subtituloSellado(f)}</small></td>
      <td>${pesos(f.precio)}</td>
      <td>${celdaMarket(f)}</td>
      <td>${porcentaje(f.diferencia)}</td>
      <td>${escapar(f.nTiendas)}</td>
      <td>${pesos(f.sugerido)}</td>
    </tr>`,
  },
  brechas: {
    columnas: [['nombre', 'Producto'], ['market', 'Market'], ['conStock', 'Tiendas con stock'], ['sugerido', 'Sugerido']],
    resumen: (n) => `${n} productos sellados con stock en otras tiendas que La Ira no tiene con stock. * = solo una tienda con stock.`,
    fila: (f, i) => `<tr data-i="${i}">
      <td>${escapar(f.nombre)}${f.reciente ? '<span class="etiqueta reciente">reciente</span>' : ''}<small>${subtituloSellado(f)}</small></td>
      <td>${celdaMarket(f)}</td>
      <td>${escapar(f.conStock)}</td>
      <td>${pesos(f.sugerido)}</td>
    </tr>`,
  },
};

function filtrarSellado(filas) {
  const formato = $('#formato-sellado').value;
  const tipo = $('#tipo').value;
  const texto = $('#buscar').value.trim().toLowerCase();
  return filas.filter((f) => (!formato || f.formato === formato)
    && (!tipo || f.tipo === tipo)
    && (!texto || f.nombre.toLowerCase().includes(texto)));
}

async function renderSellado(tipo) {
  const propio = ++turno;
  const datos = await cargarSellado();
  if (propio !== turno) return;
  const filas = datos?.[tipo];
  if (!Array.isArray(filas) || !filas.length) {
    mostrarVacio(SELLADO_PRONTO);
    return;
  }
  const visibles = ordenar(filtrarSellado(filas), estado.ordenes[estado.vista]);
  const { columnas, fila, resumen } = COLUMNAS_SELLADO[tipo];
  $('#resumen').textContent = resumen(visibles.length, filas.length);
  $('#tabla').innerHTML = tabla(columnas, visibles, fila);
  conectar(visibles, abrirDetalleSellado);
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

function precioEnTienda(t) {
  if (t.ambiguo) return 'varios precios';
  return t.atipico ? `${pesos(t.precio)} <span class="etiqueta">fuera de rango</span>` : pesos(t.precio);
}

function mostrarDetalle(f, { sub, tienda, imagen, pie }) {
  const tiendas = [...f.tiendas].sort((a, b) => (a.precio ?? Number.MAX_SAFE_INTEGER) - (b.precio ?? Number.MAX_SAFE_INTEGER));
  $('#detalle-contenido').innerHTML = `
    ${esWeb(imagen) ? `<img src="${escapar(imagen)}" alt="" loading="lazy">` : ''}
    <h2>${escapar(f.nombre)}</h2>
    <p class="nota">${sub}</p>
    <p>Market: <strong>${celdaMarket(f)}</strong> · Sugerido: <strong>${pesos(f.sugerido)}</strong>${vacio(f.min) || vacio(f.max) ? '' : ` · Rango: <strong>${pesos(f.min)} – ${pesos(f.max)}</strong>`}</p>
    <table><thead><tr><th>Tienda</th><th>Precio</th><th>Stock</th></tr></thead><tbody>
      ${tiendas.map((t) => `<tr><td>${enlaceTienda(t.url, tienda(t.tienda))}</td>
        <td>${precioEnTienda(t)}</td><td>${t.stock ? 'sí' : 'no'}</td></tr>`).join('')}
    </tbody></table>
    ${pie}`;
  $('#detalle').showModal();
}

async function abrirDetalle(f) {
  const series = await cargar(`series-${f.formato}.json`);
  mostrarDetalle(f, { sub: subtitulo(f), tienda: nombreTienda, imagen: f.imagen, pie: grafico(series[f.clave]) });
}

async function abrirDetalleSellado(f) {
  mostrarDetalle(f, {
    sub: subtituloSellado(f),
    tienda: nombreTiendaSellado,
    imagen: null,
    pie: '<p class="nota">El sellado aún no guarda historial de precios.</p>',
  });
}

function renderPie() {
  $('#actualizado').textContent = `Actualizado ${new Date(meta.generado).toLocaleString('es-CL')}.`;
  $('#tiendas').innerHTML = meta.tiendas.map((t) => {
    const viejo = t.reutilizado ? ` <em>(datos del ${t.ultimaLectura ? new Date(t.ultimaLectura).toLocaleDateString('es-CL') : '—'})</em>` : '';
    return `<li>${enlaceTienda(t.url, t.nombre)}: ${t.listados} (${t.conStock} con stock)${viejo}</li>`;
  }).join('');
  const sellado = meta.sellado?.tiendas ?? [];
  const reutilizadas = sellado.filter((t) => t.reutilizado).length;
  $('#pie-sellado').textContent = sellado.length
    ? `Sellado: ${sellado.length} tiendas${reutilizadas ? ` (${reutilizadas} con datos anteriores)` : ''}.`
    : '';
  $('#pie-sellado').hidden = !sellado.length;
}

function marcarMenu() {
  document.querySelectorAll('#menu nav a').forEach((a) => {
    const activa = a.getAttribute('href') === `#${estado.vista}`;
    a.classList.toggle('activa', activa);
    if (activa) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function mostrarEncabezado(vista) {
  $('#titulo').textContent = vista.titulo;
  $('#descripcion').textContent = vista.descripcion;
  document.title = `${vista.titulo} · MyL Market`;
  $('#filtros').hidden = !vista.filtros.length;
  if (vista.buscar) {
    $('#buscar').placeholder = vista.buscar;
    $('#buscar').setAttribute('aria-label', vista.buscar.replace('…', ''));
  }
  FILTROS.forEach((id) => { $(`#${id}`).hidden = !vista.filtros.includes(id); });
}

async function render() {
  const vista = VISTAS[estado.vista];
  marcarMenu();
  mostrarEncabezado(vista);
  await vista.render();
}

function fallar(error) {
  console.error(error);
  $('#resumen').textContent = 'No se pudieron cargar los datos.';
}

function refrescar() {
  render().catch(fallar);
}

function vistaDesdeHash() {
  const clave = decodeURIComponent(location.hash.slice(1));
  return Object.hasOwn(VISTAS, clave) ? clave : VISTA_INICIAL;
}

function abrirMenu() {
  $('#menu').classList.add('abierto');
  $('#velo').hidden = false;
  $('#abrir-menu').setAttribute('aria-expanded', 'true');
  $('#menu nav a.activa')?.focus();
}

function cerrarMenu() {
  if (!$('#menu').classList.contains('abierto')) return;
  $('#menu').classList.remove('abierto');
  $('#velo').hidden = true;
  $('#abrir-menu').setAttribute('aria-expanded', 'false');
}

function navegar() {
  estado.vista = vistaDesdeHash();
  if (location.hash !== `#${estado.vista}`) history.replaceState(null, '', `#${estado.vista}`);
  cerrarMenu();
  refrescar();
}

function conectarMenu() {
  $('#abrir-menu').addEventListener('click', abrirMenu);
  $('#velo').addEventListener('click', cerrarMenu);
  document.querySelectorAll('#menu a').forEach((a) => a.addEventListener('click', cerrarMenu));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenu(); });
  window.matchMedia('(min-width: 768px)').addEventListener('change', cerrarMenu);
  window.addEventListener('hashchange', navegar);
}

function conectarFiltros() {
  $('#formato').addEventListener('change', () => {
    llenarEdiciones();
    refrescar();
  });
  $('#edicion').addEventListener('change', refrescar);
  $('#estado').addEventListener('change', refrescar);
  $('#formato-sellado').addEventListener('change', refrescar);
  $('#tipo').addEventListener('change', refrescar);
  $('#buscar').addEventListener('input', refrescar);
}

async function iniciar() {
  conectarMenu();
  meta = await cargar('meta.json');
  llenarEdiciones();
  conectarFiltros();
  renderPie();
  navegar();
}

iniciar().catch(fallar);
