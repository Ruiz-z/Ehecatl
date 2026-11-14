import { AppShell } from '@/shared/components/app-shell';
export default function Layout({
  children
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
