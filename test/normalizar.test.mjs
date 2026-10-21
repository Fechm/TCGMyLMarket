import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizarNombre, codigo, decodificar, esRareza, plano } from '../src/normalizar.mjs';

test('decodificar entidades numéricas y con nombre', () => {
  assert.equal(decodificar('Dub &#8211; Sar &amp; Co&nbsp;X'), 'Dub – Sar & Co X');
});

test('plano quita tildes, baja a minúsculas y unifica guiones', () => {
  assert.equal(plano('  Ñandú   Dorado – SP '), 'nandu dorado - sp');
  assert.equal(plano('Valor\u0096Real'), 'valor-real');
});

test('codigo quita numeración final y puntuación', () => {
  assert.equal(codigo('lpb 4.0'), 'lpb 4 0');
  assert.equal(codigo('xs-108-128'), 'xs');
  assert.equal(codigo('acr-133'), 'acr');
  assert.equal(codigo('hlpe26'), 'hlpe26');
});

test('esRareza reconoce rarezas y variantes', () => {
  assert.equal(esRareza('legendaria'), true);
  assert.equal(esRareza('real'), true);
  assert.equal(esRareza('lpb 4 0'), false);
});

const casos = [
  ['Carwennan (LPB 4.0 - Legendaria)', 'carwennan', 'normal', ['lpb 4 0', 'legendaria']],
  ['NACIMIENTO DE PEGASO - LPB4 - SECRETA', 'nacimiento de pegaso', 'secreta', ['lpb4', 'secreta']],
  ['Figuras Negras (LBPB24 - Ultra Secreta)', 'figuras negras', 'ultra-secreta', ['lbpb24', 'ultra secreta']],
  ['Guerrero Mixteco FOIL', 'guerrero mixteco', 'foil', []],
  ['Visión Heroica sin foil', 'vision heroica', 'normal', []],
  ['FELIPE II &#8211; SP', 'felipe ii', 'sp', ['sp']],
  ['RAYOS-SP', 'rayos', 'sp', []],
  ['(XS-108-128) Ishkur Bestial – Vasallo', 'ishkur bestial', 'normal', ['xs', 'vasallo']],
  ['Batalla de Sluys ACR-133', 'batalla de sluys', 'normal', ['acr']],
  ['Salmón del Saber (HD Aniversario - Buy a Box)', 'salmon del saber', 'buy-a-box', ['hd aniversario', 'buy a box']],
  ['Abismo JO', 'abismo', 'promo', []],
  ['Mano del Muerto (HLPE26 - Abismo)', 'mano del muerto', 'normal', ['hlpe26', 'abismo']],
  ['Cernunnos, Leyendas', 'cernunnos', 'normal', []],
  ['El Lobo (Drácula - Legendaria Alternativa)', 'el lobo', 'alternativa', ['dracula', 'legendaria alternativa']],
  ['Paladín Harker (Secretos Arcanos - Real)', 'paladin harker', 'normal', ['secretos arcanos', 'real']],
  ['Dawit II – Mega Real', 'dawit ii', 'normal', ['mega real']],
  ['Mago Merlin (Rework) (Aniversario 25 Años)', 'mago merlin', 'normal', ['rework', 'aniversario 25 anos']],
];

for (const [nombre, nombreClave, variante, codigos] of casos) {
  test(`analizarNombre: ${nombre}`, () => {
    assert.deepEqual(analizarNombre(nombre), { nombreClave, variante, codigos });
  });
}
