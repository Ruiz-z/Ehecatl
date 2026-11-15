'use client';

import { parcelUrl, resolveParcelTab } from '@/features/parcels/parcel-tabs';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Map, Sprout, ChartNoAxesCombined, SlidersHorizontal, LogOut } from 'lucide-react';
import { useDemo } from '@/features/identity/demo-provider';
import { Brand, DemoChip, LoadingState } from './ui';
import { useMocks } from '@/shared/api/client';
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
    parcels,
    error
  } = useDemo();
  const path = usePathname();
  const search = useSearchParams();
  const activeIndex = path.startsWith('/parcelas/') && path !== '/parcelas/nueva' ? (resolveParcelTab(search.get('tab')) === 'datos' ? 2 : resolveParcelTab(search.get('tab')) === 'sembrar' ? 1 : 0) : 0;
  const parcelId = path.split('/')[2];
  const targetId = parcelId && parcelId !== 'nueva' ? parcelId : parcels[0]?.id;
  const decisionUrl = targetId ? parcelUrl(targetId) : '/parcelas';
  const nav = [{
    href: '/parcelas',
    icon: Map,
    name: 'Parcelas'
  }, {
    href: decisionUrl,
    icon: Sprout,
    name: 'Qué sembrar'
  }, {
    href: targetId ? parcelUrl(targetId, 'datos') : '/parcelas',
    icon: ChartNoAxesCombined,
    name: 'Datos NASA'
  }, {
    href: `${decisionUrl}#prioridades`,
    icon: SlidersHorizontal,
    name: 'Prioridades'
  }];
  const router = useRouter();
  useEffect(() => { if (ready && !user) router.replace('/login'); }, [ready, user, router]);
  if (!ready || !user) return <LoadingState />;
  if (error) return <main className="session-empty"><h1>No pudimos cargar tus parcelas</h1><p role="alert">{error}</p><button className="button" onClick={logout}>Cerrar sesión</button></main>;
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
          {useMocks && <DemoChip />}
          <button className="mobile-logout" aria-label="Salir y cambiar perfil" title="Salir y cambiar perfil" onClick={logout}><LogOut size={17} /></button>
        </div>
      </header>
      {children}
    </div>
  </div>;
}
