const PROTOCOLOS = new Set(['http:', 'https:']);

export function urlSegura(valor, base) {
  if (typeof valor !== 'string' || !valor.trim()) return null;
  try {
    const url = new URL(valor, base);
    return PROTOCOLOS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
