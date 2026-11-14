'use client';
import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { demoUsers } from './fixtures/users';
import { useDemo } from './demo-provider';
import { validateLogin } from './validation';
import { demoPassword, useMocks } from '@/shared/api/client';
import { Brand, DemoChip } from '@/shared/components/ui';
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const { login } = useDemo();
  return <main id="main" className="login-page">
    <div className="login-top"><Brand /></div>
    <div className="login-intro"><h1>Conoce tu tierra.<br />Decide qué sigue.</h1><p>Tu parcela, el clima y el siguiente cultivo.</p></div>
    <section className="login-card">
      {useMocks && <DemoChip />}
      <h2>Entra a tu campo</h2>
      <p>Inicia sesión para ver tus parcelas.</p>
      <form noValidate onSubmit={async event => {
        event.preventDefault(); const invalid = validateLogin({ email, password }); setError(invalid ?? ''); if (invalid) return;
        setPending(true); try { await login({ email, password }); } catch (e) { setError(e instanceof Error ? e.message : 'No pudimos iniciar sesión. Intenta de nuevo.'); } finally { setPending(false); }
      }}>
        <label className="login-field">Correo electrónico<input name="email" type="email" autoComplete="username" required value={email} aria-describedby={error ? 'login-error' : undefined} onChange={e => setEmail(e.target.value)} /></label>
        <label className="login-field">Contraseña<input name="password" type="password" autoComplete="current-password" required value={password} aria-describedby={error ? 'login-error' : undefined} onChange={e => setPassword(e.target.value)} /></label>
        {error && <p id="login-error" className="error-text" role="alert">{error}</p>}
        <button disabled={pending} className="button primary login-submit" type="submit">{pending ? 'Entrando…' : 'Entrar a mis parcelas'}<ArrowRight size={18} /></button>
      </form>
      {useMocks && <fieldset className="demo-shortcuts"><legend>Usar cuenta demo</legend>{demoUsers.map(user => <button key={user.id} type="button" className="demo-account" onClick={() => { setEmail(user.email); setPassword(demoPassword); setError(''); }}><strong>{user.name}</strong><span>{user.region}</span></button>)}<p className="login-note">Los atajos rellenan el formulario. Contraseña pública de demo: {demoPassword}</p></fieldset>}
    </section>
    <footer className="login-footer"><span>NASA Space Apps 2026 · Field Shift</span></footer>
  </main>;
}
