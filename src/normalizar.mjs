const ENTIDADES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

const SUFIJOS = [
  'ultra secreta', 'ultra secreto', 'mega real', 'ultra real', 'sin foil', 'buy a box',
  'foil', 'lluvia', 'secreta', 'secreto', 'legendaria', 'legendario', 'real', 'ur', 'mr', 'sp',
  'vasallo', 'vasalla', 'cortesano', 'cortesana', 'milenaria', 'premium', 'promo', 'promocional',
  'jo', 'kit', 'rework', 'alternativa', 'alternativo', 'leyendas',
].sort((a, b) => b.length - a.length);

const RAREZAS = new Set(SUFIJOS);

const VARIANTES = [
  ['ultra-secreta', /\bultra ?secret[ao]\b/],
  ['secreta', /\bsecret[ao]\b/],
  ['alternativa', /\balternativ[ao]\b|\bfull art\b/],
  ['buy-a-box', /\bbuy a box\b|\bbab\b/],
  ['sp', /\bsp\b/],
  ['promo', /\bpromo(cional)?\b|\bjo\b|juego organizado|\bstaff\b|\btorneo\b/],
  ['foil', /(?<!sin )\bfoil\b/],
];

export function decodificar(texto) {
  return String(texto ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (entidad, n) => ENTIDADES[n.toLowerCase()] ?? entidad)
    .replace(/\u00a0/g, ' ');
}

export function plano(texto) {
  return decodificar(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u0096\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function limpiar(texto) {
  return texto.replace(/[^a-z0-9&]+/g, ' ').trim();
}

export function codigo(segmento) {
  return limpiar(plano(segmento).replace(/-\d+(-\d+)*$/, ''));
}

export function esRareza(valor) {
  return RAREZAS.has(valor);
}

function quitarSufijos(base) {
  let actual = base;
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const sufijo of SUFIJOS) {
      if (actual.endsWith(` ${sufijo}`)) {
        actual = actual.slice(0, -(sufijo.length + 1)).trim();
        cambio = true;
        break;
      }
    }
  }
  return actual;
}

export function analizarNombre(nombre) {
  const segmentos = [];
  let texto = plano(nombre).replace(/\(([^)]*)\)/g, (_, dentro) => {
    segmentos.push(...dentro.split(' - '));
    return ' ';
  });
  texto = texto.replace(/\s([a-z&]{2,4}-\d+)$/, (_, cod) => {
    segmentos.push(cod);
    return '';
  });
  const partes = texto.split(' - ');
  const base = partes.shift() ?? '';
  segmentos.push(...partes);
  const limpios = segmentos.map((s) => s.trim()).filter(Boolean);
  const todo = [base, ...limpios].join(' | ');
  const variante = VARIANTES.find(([, patron]) => patron.test(todo))?.[0] ?? 'normal';
  return {
    nombreClave: quitarSufijos(limpiar(base)),
    variante,
    codigos: [...new Set(limpios.map(codigo).filter(Boolean))],
  };
}
