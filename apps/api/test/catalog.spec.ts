import { crops, familyRules, validateCatalog } from '../src/modules/crop-knowledge/crop-catalog.js';

describe('B11 catálogo trazable', () => {
  it('incluye 15–20 cultivos y todas las transiciones familiares', () => {
    expect(crops.length).toBeGreaterThanOrEqual(15);
    expect(crops.length).toBeLessThanOrEqual(20);
    expect(validateCatalog(crops)).toEqual(crops);
    const families = new Set(crops.map(c => c.family));
    expect(familyRules).toHaveLength(families.size ** 2);
  });
  it.each(['waterMm', 'cycleDays', 'family', 'sources', 'kc', 'kcSource', 'ky', 'kySource', 'kyEstimated', 'marketValueTier', 'marketValueSource'])('señala cultivo y campo %s faltante', field => {
    const broken = { ...crops[0], [field]: undefined };
    expect(() => validateCatalog([broken])).toThrow(new RegExp(`${crops[0].id}.*${field}`));
  });
  it('ingreso sale de categorías explícitas y marca estimaciones pendientes de H4', () => {
    for (const crop of crops) {
      expect(crop.incomeOpportunity).toBe({ bajo: 25, medio: 60, alto: 90 }[crop.marketValueTier]);
      expect(crop.marketValueSource).toContain('estimado');
    }
    expect(() => validateCatalog([{ ...crops[0], incomeOpportunity: 17 }])).toThrow('incomeOpportunity');
  });
  it('rechaza duplicados, unidades inválidas y rangos invertidos', () => {
    expect(() => validateCatalog([crops[0], crops[0]])).toThrow('duplicate');
    expect(() => validateCatalog([{ ...crops[0], waterMm: -1 }])).toThrow('waterMm');
    expect(() => validateCatalog([{ ...crops[0], tempMin: 99 }])).toThrow('temperature');
  });
});

it.each([NaN, 0, 1.5, null, '0.3'])('rechaza Kc inválido %s', value => {
  expect(() => validateCatalog([{...crops[0],kc:{...crops[0].kc,ini:value}}])).toThrow('kc.ini');
});

it('cita la fila de Ky de FAO y marca los sustitutos', () => {
  expect(crops.find(c => c.id === 'maize')!).toMatchObject({ky:1.25,kyEstimated:false});
  expect(crops.find(c => c.id === 'lentil')!).toMatchObject({ky:1.15,kyEstimated:true});
  expect(crops.find(c => c.id === 'lentil')!.kySource).toContain('Peas');
  for (const crop of crops) {
    expect(crop.kySource).toContain('tabla 1, p. 7');
    expect(crop.kySource).toContain('https://www.fao.org/4/i2800e/i2800e.pdf');
  }
});
