import { FlaskConical, Sprout } from 'lucide-react';
import Link from 'next/link';
export function Brand({
  compact = false
}: {
  compact?: boolean;
}) {
  return <Link href="/parcelas" className={`brand ${compact ? 'compact' : ''}`} aria-label="Ehécatl, mis parcelas"><Sprout size={28} strokeWidth={1.75} />{!compact && <span>ehécatl<span className="brand-dot">.</span></span>}</Link>;
}
export function DemoChip() {
  return <span className="chip demo-chip"><FlaskConical size={13} />Datos de ejemplo</span>;
}
export function EmptyState({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return <div className="empty-state">
    <Sprout size={36} strokeWidth={1.25} />
    <h2>{title}</h2>
    {children}
  </div>;
}
export function LoadingState() {
  return <div className="loading-state" role="status" aria-label="Cargando datos de la parcela">
    <div className="skeleton skeleton-title" />
    <div className="skeleton skeleton-image" />
    <div className="skeleton" />
    <div className="skeleton" />
    <span>Cargando tu parcela…</span>
  </div>;
}
export function Notice({ children, variant = 'warning', label, title, error = false }: {
  children: React.ReactNode;
  variant?: 'risk' | 'warning' | 'info';
  label: string;
  title: string;
  error?: boolean;
}) {
  return <div className={`notice notice-${variant}`} role={error ? 'alert' : undefined}>
    <span className="notice-label">{label}</span>
    <h3>{title}</h3>
    <div className="notice-body">{children}</div>
  </div>;
}
