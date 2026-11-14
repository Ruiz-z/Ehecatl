'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Map, Sprout, ChartNoAxesCombined, SlidersHorizontal, LogOut, ArrowRight } from 'lucide-react';
import { useDemo } from '@/features/identity/demo-provider';
import { Brand, DemoChip, LoadingState } from './ui';
export function AppShell({
  children
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<LoadingState />}><Shell>{children}</Shell></Suspense>;
}
function Shell({
  children
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    ready,
    logout,
    parcels
  } = useDemo();
  const path = usePathname();
  const search = useSearchParams();
  const activeIndex = search.get('tab') === 'datos' ? 2 : search.get('tab') === 'sembrar' ? 1 : 0;
  const parcelId = path.split('/')[2];
  const base = `/parcelas/${parcelId && parcelId !== 'nueva' ? parcelId : parcels[0]?.id ?? ''}`;
  const nav = [{
    href: '/parcelas',
    icon: Map,
    name: 'Parcelas'
  }, {
    href: `${base}?tab=sembrar`,
    icon: Sprout,
    name: 'Qué sembrar'
  }, {
    href: `${base}?tab=datos`,
    icon: ChartNoAxesCombined,
    name: 'Datos NASA'
  }, {
    href: `${base}?tab=sembrar#prioridades`,
    icon: SlidersHorizontal,
    name: 'Prioridades'
  }];
  if (!ready) return <LoadingState />;
  if (!user) return <main id="main" className="session-empty">
    <Brand />
    <h1>Tu campo, en perspectiva.</h1>
    <p>Elige un perfil de ejemplo para explorar sus parcelas.</p>
    <Link className="button primary" href="/login">Elegir perfil<ArrowRight size={18} /></Link>
  </main>;
  return <div className="app-shell">
    <a className="skip-link" href="#main">Saltar al contenido</a>
    <aside className="rail">
      <Brand compact />
      <nav aria-label="Navegación principal">
        {nav.map(({
          href,
          icon: Icon,
          name
        }, index) => <Link key={name} href={href} className={index === activeIndex ? 'rail-link active' : 'rail-link'} aria-current={index === activeIndex ? 'page' : undefined} title={name} aria-label={name}><Icon size={21} strokeWidth={1.75} /><span>{name}</span></Link>)}
      </nav>
      <div className="rail-bottom">
        <span className="user-avatar" title={user.name}>{user.initials}</span>
        <button aria-label="Salir y cambiar perfil" title="Salir y cambiar perfil" onClick={logout}><LogOut size={20} /></button>
      </div>
    </aside>
    <div className="app-body">
      <header className="topbar">
        <div>
          <span className="topbar-product">Mi campo</span>
          <span className="topbar-divider">/</span>
          <span>{user.name}</span>
        </div>
        <div className="topbar-actions">
          <DemoChip />
          <button className="mobile-logout" aria-label="Salir y cambiar perfil" title="Salir y cambiar perfil" onClick={logout}><LogOut size={17} /></button>
        </div>
      </header>
      {children}
    </div>
  </div>;
}
