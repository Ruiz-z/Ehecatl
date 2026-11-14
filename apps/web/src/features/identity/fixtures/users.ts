import type { DemoUser } from '@/features/parcels/types';
export const demoUsers: DemoUser[] = [{
  id: 'ana',
  name: 'Ana Martínez',
  initials: 'AM',
  region: 'Coahuila, México',
  description: 'Clima árido · cuidar cada gota',
  priorities: {
    water: 45,
    soil: 25,
    income: 15,
    risk: 15
  }
}, {
  id: 'james',
  name: 'James Wilson',
  initials: 'JW',
  region: 'Nevada, Estados Unidos',
  description: 'Riego restringido · reducir el riesgo',
  priorities: {
    water: 30,
    soil: 10,
    income: 15,
    risk: 45
  }
}, {
  id: 'lucia',
  name: 'Lucía Fernández',
  initials: 'LF',
  region: 'Entre Ríos, Argentina',
  description: 'Clima húmedo · recuperar el suelo',
  priorities: {
    water: 10,
    soil: 45,
    income: 35,
    risk: 10
  }
}];
export const demoClimateByOwner: Record<string, 'dry' | 'humid'> = {
  ana: 'dry',
  james: 'dry',
  lucia: 'humid'
};
