import { analizarNombre, codigo, plano } from './normalizar.mjs';

export function normalizarPista(pista) {
  const corte = pista.indexOf(':');
  const tipo = pista.slice(0, corte);
  const valor = pista.slice(corte + 1);
  return `${tipo}:${tipo === 'cod' ? codigo(valor) : plano(valor)}`;
}

export function crearIndice(ediciones) {
  const porTienda = new Map();
  for (const [id, edicion] of Object.entries(ediciones)) {
    for (const [tienda, alias] of Object.entries(edicion.alias ?? {})) {
      if (!porTienda.has(tienda)) porTienda.set(tienda, new Map());
      const mapa = porTienda.get(tienda);
      for (const pista of alias) {
        const clave = normalizarPista(pista);
        mapa.set(clave, [...(mapa.get(clave) ?? []), id]);
      }
    }
  }
  return { ediciones, porTienda };
}

function resolverEdicion(indice, tienda, pistas, formato) {
  const mapa = indice.porTienda.get(tienda) ?? new Map();
  const fuertes = new Set();
  const debiles = new Set();
  for (const pista of pistas) {
    const normal = normalizarPista(pista);
    for (const id of mapa.get(normal) ?? []) (normal.startsWith('cod:') ? debiles : fuertes).add(id);
  }
  const validas = (ids) => [...ids].filter((id) => !formato || indice.ediciones[id].formato === formato);
  const fuertesValidas = validas(fuertes);
  const candidatas = fuertesValidas.length ? fuertesValidas : validas(debiles);
  if (candidatas.length === 1) return { edicion: candidatas[0] };
  return { motivo: candidatas.length ? 'ambigua' : 'sin-alias' };
}

export function emparejar(indice, listados) {
  const emparejados = [];
  const sinEmparejar = [];
  for (const listado of listados) {
    const { nombreClave, variante, codigos } = analizarNombre(listado.nombre);
    const pistas = [...listado.pistas, ...codigos.map((c) => `cod:${c}`)];
    const base = { ...listado, pistas, nombreClave, variante };
    const resultado = resolverEdicion(indice, listado.tienda, pistas, listado.formato);
    if (resultado.edicion && nombreClave) {
      emparejados.push({ ...base, edicion: resultado.edicion, clave: `${nombreClave}|${resultado.edicion}|${variante}` });
    } else {
      sinEmparejar.push({ ...base, motivo: resultado.motivo ?? 'sin-nombre' });
    }
  }
  return { emparejados, sinEmparejar };
}
