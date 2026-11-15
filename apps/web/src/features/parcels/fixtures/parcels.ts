import type { Parcel } from '../types';
// El estado usa el mismo diccionario que los datos reales mediante mockIndicatorResponse.
export const demoParcels: Parcel[] = [{
  id: 'el-mezquite',
  ownerId: 'ana',
  name: 'El Mezquite',
  place: 'San Pedro, Coahuila',
  latitude: 25.758,
  longitude: -103.05,
  crop: 'Maíz',
  irrigation: true,
  area: 24.5,
  risk: 'high',
  dataState: 'ready'
}, {
  id: 'la-esperanza',
  ownerId: 'ana',
  name: 'La Esperanza',
  place: 'San Pedro, Coahuila',
  latitude: 25.784,
  longitude: -103.085,
  crop: 'Sorgo',
  irrigation: false,
  area: 18,
  risk: 'moderate',
  dataState: 'empty'
}, {
  id: 'silver-creek',
  ownerId: 'james',
  name: 'Silver Creek',
  place: 'Fallon, Nevada',
  latitude: 39.474,
  longitude: -118.79,
  crop: 'Alfalfa',
  irrigation: true,
  area: 42,
  risk: 'high',
  dataState: 'error'
}, {
  id: 'north-field',
  ownerId: 'james',
  name: 'North Field',
  place: 'Fallon, Nevada',
  latitude: 39.51,
  longitude: -118.83,
  crop: 'Cebada',
  irrigation: false,
  area: 16,
  risk: 'high',
  dataState: 'no-windows'
}, {
  id: 'los-ceibos',
  ownerId: 'lucia',
  name: 'Los Ceibos',
  place: 'Paraná, Entre Ríos',
  latitude: -31.79,
  longitude: -60.39,
  crop: 'Soja',
  irrigation: false,
  area: 65,
  risk: 'low',
  dataState: 'ready'
}];
