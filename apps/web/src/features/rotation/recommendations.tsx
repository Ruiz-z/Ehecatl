'use client';

import { useMemo, useState } from 'react';
import { Droplets, Sprout, TrendingUp, ShieldCheck, CalendarDays, ChevronDown, Info, Check, RotateCcw } from 'lucide-react';
import type { Parcel, Priorities } from '@/features/parcels/types';
import { useDemo } from '@/features/identity/demo-provider';
import { Notice } from '@/shared/components/ui';
import { strategiesFor } from './fixtures/strategies';
import { axes, normalizedWeights, rankStrategies } from './ranking';
import type { RankedStrategy } from './types';
const icons = {
  water: Droplets,
  soil: Sprout,
  income: TrendingUp,
  risk: ShieldCheck
};
const months = ['N', 'D', 'E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O'];
const validation = 'Esta sugerencia se basa en datos satelitales de 10 años y reglas FAO/SARE; valida disponibilidad de semilla, maquinaria y mercado con tu agrónomo local';
function SequenceCard({
  strategy,
  index,
  weights
}: {
  strategy: RankedStrategy;
  index: number;
  weights: Priorities;
}) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = expanded ?? index === 0;
  return <article className={`sequence-card ${index === 0 ? 'best' : ''} ${strategy.baseline ? 'baseline' : ''}`}>
    <div className="sequence-label">
      <span>{index === 0 ? <><Check size={13} />Mejor ajuste para ti</> : strategy.baseline ? 'Si no cambias' : 'Otra opción viable'}</span>
      <span>0{index + 1}</span>
    </div>
    <div className="sequence-title">
      <h3>{strategy.name}</h3>
      <div className="score">
        {strategy.score}
        <small>/100</small>
      </div>
    </div>
    <p className={`score-delta ${strategy.baseline ? 'muted' : ''}`}>{strategy.baseline ? 'Estrategia actual · referencia' : `${strategy.delta >= 0 ? '+' : ''}${strategy.delta} puntos frente a mantener lo actual`}</p>
    <div className="timeline">
      <div className="timeline-years">
        <span>2026</span>
        <span>2027</span>
        <span>2028</span>
      </div>
      <div className="timeline-months">
        {[...months, ...months].map((month, i) => <span key={i}>{month}</span>)}
      </div>
      <div className="timeline-tracks">
        {strategy.windows.map((window, i) => <div key={i} className={`crop-window family-${window.family} ${window.current ? 'current-crop' : ''}`} style={{
          gridColumn: `${window.startMonth + 1} / span ${Math.min(window.months, 24 - window.startMonth)}`
        }} title={`${window.crop}: ${window.months} meses${window.current ? ', cultivo actual' : ''}`}>
          <span>{window.crop}</span>
        </div>)}
      </div>
      <p className="timeline-note"><span className="hatched-swatch" />Cultivo actual · horizonte de 24 meses</p>
    </div>
    <div className="change-date">
      <CalendarDays size={17} />
      <div>
        <span>Cuándo cambiar</span>
        <strong>{strategy.changeAt}</strong>
      </div>
    </div>
    <div className="axis-bars">
      {axes.map(({
        key,
        label
      }) => {
        const Icon = icons[key];
        return <div className="axis-row" key={key}>
        <span><Icon size={13} />{label}</span>
        <div className="bar-track">
          <i style={{
              width: `${strategy.axes[key]}%`
            }} />
        </div>
        <span className="axis-value">{strategy.axes[key]}</span>
        <small>{Math.round(weights[key] * 100)} % peso</small>
      </div>;
      })}
      <p>Más alto = más favorable, también en riesgo.</p>
    </div>
    <button className="reasons-toggle" aria-expanded={open} onClick={() => setExpanded(!open)}>Por qué y qué riesgos tiene<ChevronDown size={16} className={open ? 'rotate' : ''} /></button>
    {open && <div className="reasons-content">
      {strategy.reasons.map(reason => <div className="reason" key={reason.origin}>
        <span className="reason-origin">{reason.origin}<small>Pesó {weights[reason.axis] >= 0.3 ? 'mucho' : 'algo'}</small></span>
        <p>{reason.text}</p>
      </div>)}
      <h4>Antes de decidir</h4>
      <ul>
        {strategy.risks.map(risk => <li key={risk}>{risk}</li>)}
      </ul>
    </div>}
    <div className="confidence">
      <span className="chip neutral-chip"><ShieldCheck size={13} />Confianza {strategy.confidence.toLowerCase()}</span>
      <p>{strategy.confidenceReason}</p>
    </div>
    <p className="validation-note"><Info size={14} />{validation}</p>
  </article>;
}
export function Recommendations({
  parcel
}: {
  parcel: Parcel;
}) {
  const {
    user
  } = useDemo();
  const defaults = user?.priorities ?? {
    water: 25,
    soil: 25,
    income: 25,
    risk: 25
  };
  const [weights, setWeights] = useState<Priorities>(defaults);
  const normalized = normalizedWeights(weights);
  const strategies = useMemo(() => strategiesFor(parcel), [parcel]);
  const ranked = rankStrategies(strategies, weights);
  if (parcel.dataState === 'no-windows') return <div className="no-windows">
    <CalendarDays size={32} />
    <h2>No hay una ventana segura para sembrar</h2>
    <p>En este ejemplo, el agua disponible no alcanza para completar un ciclo en los próximos 24 meses.</p>
    <Notice>Conserva la cobertura del suelo y revisa la disponibilidad de agua con tu agrónomo antes de planear una siembra.</Notice>
    <p className="muted">No mostramos puntajes de cultivos que no son viables.</p>
  </div>;
  return <div className="recommendations">
    <div className="section-heading">
      <div>
        <h2>Qué sembrar después</h2>
        <p>Tres caminos para tu tierra. Tú decides qué pesa más.</p>
      </div>
      <span className="chip neutral-chip">Nov 2026 — Oct 2028</span>
    </div>
    {parcel.risk === 'high' && <Notice><strong>El agua está cambiando las reglas.</strong><p>{parcel.crop} requiere más agua de la disponible en este ejemplo. Planea el siguiente ciclo con una opción más tolerante.</p></Notice>}
    {ranked[0].baseline && <div className="baseline-wins" role="status"><Check size={18} />Con tus prioridades, mantener lo actual es la mejor opción. Su potencial de ingreso compensa el menor aporte al suelo.</div>}
    <div className="inputs-used">
      <span><i />Datos NASA <small>clima de 10 años</small></span>
      <span><i />Tu parcela <small>{parcel.irrigation ? 'con riego' : 'de temporal'} · {parcel.crop}</small></span>
      <span><i />Tus prioridades <small>ajustables abajo</small></span>
    </div>
    <p className="sr-only" aria-live="polite">Mejor opción: {ranked[0].name}, {ranked[0].score} puntos.</p>
    <div className="sequence-grid">
      {ranked.map((strategy, index) => <SequenceCard key={strategy.id} strategy={strategy} index={index} weights={normalized} />)}
    </div>
    <section id="prioridades" className="priorities">
      <div className="section-heading">
        <div>
          <h2>Tu campo. Tus prioridades.</h2>
          <p>Mueve los controles y compara cómo cambia el orden.</p>
        </div>
        <button className="text-button" onClick={() => setWeights(defaults)}><RotateCcw size={15} />Restablecer</button>
      </div>
      <div className="sliders">
        {axes.map(({
          key,
          label,
          description
        }) => {
          const Icon = icons[key];
          return <label key={key} className="priority-slider">
          <span><Icon size={18} />{label}<output>{Math.round(normalized[key] * 100)} %</output></span>
          <small>{description}</small>
          <input type="range" min="0" max="100" step="1" value={weights[key]} aria-label={`Prioridad de ${label}`} aria-valuetext={`${weights[key]} de 100; peso normalizado ${Math.round(normalized[key] * 100)} por ciento`} onChange={event => setWeights({
              ...weights,
              [key]: Number(event.target.value)
            })} />
          <span className="slider-extremes"><small>Menos</small><small>Más</small></span>
        </label>;
        })}
      </div>
      <p className="form-note">Los pesos se normalizan a 100 %. Ingreso compara categorías de cultivos, no precios en tiempo real.</p>
    </section>
  </div>;
}
