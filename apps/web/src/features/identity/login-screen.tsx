'use client';

import { ArrowRight, MapPin } from 'lucide-react';
import { useState } from 'react';
import { demoUsers } from './fixtures/users';
import { useDemo } from './demo-provider';
import { Brand, DemoChip } from '@/shared/components/ui';
export function LoginScreen() {
  const [selected, setSelected] = useState(demoUsers[0].id);
  const {
    login
  } = useDemo();
  return <main id="main" className="login-page">
    <div className="login-top">
      <Brand />
      <span>El siguiente ciclo empieza con una buena decisión.</span>
    </div>
    <section className="login-card">
      <DemoChip />
      <h1>Conoce tu tierra.<br />Decide qué sigue.</h1>
      <p>El clima, tu parcela y tus prioridades, en un mismo lugar.</p>
      <form onSubmit={event => {
        event.preventDefault();
        login(selected);
      }}>
        <fieldset>
          <legend>Explora con un perfil de campo</legend>
          {demoUsers.map(user => <label key={user.id} className={`profile-option ${selected === user.id ? 'selected' : ''}`}>
            <input type="radio" name="profile" value={user.id} checked={selected === user.id} onChange={() => setSelected(user.id)} />
            <span className="avatar">{user.initials}</span>
            <span className="profile-copy"><strong>{user.name}</strong><span><MapPin size={12} />{user.region}</span><small>{user.description}</small></span>
          </label>)}
        </fieldset>
        <button type="submit" className="button primary login-submit">Entrar a mis parcelas<ArrowRight size={18} /></button>
      </form>
      <p className="login-note">Demo sin contraseña. Puedes cambiar de perfil al salir.</p>
    </section>
    <footer className="login-footer">
      <span>NASA Space Apps 2026 · Field Shift</span>
      <span>Observa hoy. Siembra con perspectiva.</span>
    </footer>
  </main>;
}
