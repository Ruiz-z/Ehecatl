'use client';

import { useState } from 'react';
import { Droplets, Sprout, TrendingUp, ShieldCheck, CalendarDays, ChevronDown, Check, RotateCcw, TriangleAlert, Minus } from 'lucide-react';
import type { Parcel, Priorities } from '@/features/parcels/types';
import { useDemo } from '@/features/identity/demo-provider';
import { apiClient, useMocks } from '@/shared/api/client';
import { formatDate, formatMonth } from '@/shared/api/adapters';
import { waitingNote } from '@/shared/api/messages';
import Link from 'next/link';
import { parcelUrl } from '@/features/parcels/parcel-tabs';
import { useAsync } from '@/shared/api/use-async';
import { EmptyState, LoadingState, Notice } from '@/shared/components/ui';
import { axes, normalizedWeights, rankStrategies, scoreContributions, scoreLevel } from './ranking';
import { summarizeRests } from './rests';
import { summarizeStep, waterSentence } from './step-summary';
import type { RankedStrategy, RecommendationResult, CycleWater, Reason } from './types';
const icons = {
  water: Droplets,
  soil: Sprout,
  income: TrendingUp,
  risk: ShieldCheck
};
const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function horizonMonths(horizonStart: string) {
  const [year, month] = horizonStart.split('-').map(Number) as [number, number];
  const start = month - 1;
  return { year, months: [...monthNames.slice(start), ...monthNames.slice(0, start)], range: `${monthNames[start]} ${year} / ${monthNames[(start + 23) % 12]} ${year + Math.floor((start + 23) / 12)}` };
}
function shortDate(value: string) {
  const [year, month] = value.split('-').map(Number);
  return `${monthNames[month! - 1]!.toLowerCase()} ${year}`;
}
function timelinePosition(start: string, end: string, horizonStart: string) {
  const first = Date.parse(`${horizonStart}-01T00:00:00Z`);
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 24);
  const duration = last.getTime() - first;
  const left = Math.max(first, Date.parse(`${start}T00:00:00Z`));
  const right = Math.min(last.getTime(), Date.parse(`${end}T00:00:00Z`) + 86400000);
  return { left: `${(left-first)/duration*100}%`, width: `${Math.max(0, right-left)/duration*100}%` };
}
const validation = 'Esta sugerencia se basa en datos satelitales de 10 años y reglas FAO/SARE; valida disponibilidad de semilla, maquinaria y mercado con tu agrónomo local';
function cycleWaterText(water: CycleWater | undefined, irrigated: boolean): string {
  if (!water) return 'Balance de agua no disponible';
  const method = water.method === 'catalog' ? 'demanda estimada del catálogo' : 'ETc';
  const rain = water.rainMm === null ? 'lluvia sin dato' : `la lluvia da ${Math.round(water.rainMm)} mm`;
  const coverage = water.coveragePct === null ? 'cobertura sin dato' : `${Math.round(water.coveragePct)} %`;
  let consequence = 'la lluvia cubre la demanda estimada';
  if (water.coveragePct === null) consequence = 'falta lluvia para calcular el déficit';
  else if (water.coveragePct < 100) consequence = irrigated ? 'el resto depende del riego' : 'déficit de lluvia; sin riego declarado';
  return `Necesita ~${Math.round(water.demandMm)} mm (${method}) · ${rain} (${coverage}) · ${consequence}`;
}
function ReasonList({ reasons }: { reasons: Reason[] }) {
  if (!reasons.length) return null;
  return <ul>{reasons.map((reason, j) => {
    const Icon = reason.effect === 'favor' ? Check : reason.effect === 'contra' ? TriangleAlert : Minus;
    const label = reason.effect === 'favor' ? 'A favor' : reason.effect === 'contra' ? 'En contra' : 'Neutral';
    return <li className={`step-reason effect-${reason.effect ?? 'neutral'}`} key={j}><Icon size={16} aria-hidden="true" /><span><span className="sr-only">{label}: </span>{reason.text}</span></li>;
  })}</ul>;
}
function SequenceCard({
  strategy,
  index,
  weights,
  horizonStart,
  irrigated
}: {
  strategy: RankedStrategy;
  index: number;
  weights: Priorities;
  horizonStart: string;
  irrigated: boolean;
}) {
  const horizon = horizonMonths(horizonStart);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = expanded ?? index === 0;
  const contributions = scoreContributions(strategy.axes, weights);
  return <article tabIndex={0} aria-label={`Opción ${index + 1}: ${strategy.name}`} className={`sequence-card ${index === 0 ? 'best' : ''} ${strategy.baseline ? 'baseline' : ''}`}>
    <div className="sequence-label">
      <span>{index === 0 ? <><Check size={13} />Mejor ajuste para ti</> : strategy.baseline ? 'Si no cambias' : 'Otra opción viable'}</span>
      <span>0{index + 1}</span>
    </div>
    <div className="sequence-title">
      <h3>{strategy.name}</h3>
      <div className="score">
        {strategy.score}
        <small>/100 · {scoreLevel(strategy.score)}</small>
      </div>
    </div>
    {(strategy.baseline || strategy.delta !== null) && <p className={`score-delta ${strategy.baseline ? 'muted' : strategy.delta! < 0 ? 'negative' : ''}`}>{strategy.baseline ? 'Estrategia actual · referencia' : `${strategy.delta! >= 0 ? '+' : ''}${strategy.delta} puntos frente a mantener lo actual`}</p>}
    <div className="timeline" tabIndex={0} role="group" aria-label="Calendario de 24 meses; usa las flechas para recorrerlo">
      <div className="timeline-years">
        <span>{horizon.year}</span>
        <span>{horizon.year + 1}</span>
        <span>{horizon.year + 2}</span>
      </div>
      <div className="timeline-months">
        {[...horizon.months, ...horizon.months].map((month, i) => i % 3 === 0 ? <span key={i} style={{ gridColumn: `${i + 1} / span 3` }}>{month}</span> : null)}
      </div>
      <div className="timeline-tracks">
        {strategy.windows.map((window, i) => <div key={i} tabIndex={0} className={`crop-window family-${window.family} ${window.current ? 'current-crop' : ''}`} style={
          window.start && window.end ? timelinePosition(window.start, window.end, horizonStart) :
          { left: `${window.startMonth/24*100}%`, width: `${Math.min(window.months,24-window.startMonth)/24*100}%` }
        } title={`${window.crop}: ${window.start ?? window.months} / ${window.end ?? 'meses'}${window.current ? ', cultivo actual' : ''}`}>
          <span>{window.crop}</span>
        </div>)}
        {strategy.rests?.map(rest => <div key={rest.start} tabIndex={0} className="crop-window rest-window"
          style={timelinePosition(rest.start, rest.end, horizonStart)}
          title={`Descanso: ${rest.reason}. ${rest.suggestion}`} aria-label={`Descanso: ${shortDate(rest.start)} / ${shortDate(rest.end)}. ${rest.reason}. ${rest.suggestion}`}>
          <span>Descanso</span>
        </div>)}
      </div>
      <p className="timeline-note"><span className="hatched-swatch" />Cultivo actual · Descanso rayado: meses sin siembra</p>
    </div>
    {!!strategy.rests?.length && (() => { const summary = summarizeRests(strategy.rests); return <div className="rest-list"><h4>Meses sin siembra</h4><ul>{summary.items.map(rest => <li key={rest.start}>
      {shortDate(rest.start)} / {shortDate(rest.end)} · {rest.reason}
    </li>)}</ul>{summary.suggestion && <p>Mientras tanto: {summary.suggestion}.</p>}</div>; })()}
    <div className="change-date">
      <CalendarDays size={17} />
      <div>
        <span>Cuándo cambiar</span>
        <strong>{strategy.changeAt}</strong>
      </div>
    </div>
    <div className="score-breakdown">
      <p>{strategy.irrigationNeedMm == null ? 'Agua faltante en 24 meses: sin dato' : `Agua faltante en 24 meses: ~${Math.round(strategy.irrigationNeedMm)} mm`}</p>
      <p>Desglose del puntaje: {contributions.map(part => `${part.label.toLowerCase()} ${Math.round(part.value)}`).join(' + ')}</p>
      <div className="score-stack" role="img" aria-label={contributions.map(part => `${part.label}: ${Math.round(part.value)} puntos`).join(', ')}>
        {contributions.map(part => <span key={part.key} className={`score-part score-${part.key}`} style={{width: `${part.value}%`}} />)}
      </div>
    </div>
    <div className="axis-bars">
      {axes.map(({
        key,
        label
      }) => {
        return <div className="axis-row" key={key}>
        <span>{label}</span>
        <div className="bar-track">
          <i style={{
              width: `${strategy.axes[key]}%`
            }} />
        </div>
        <span className="axis-value">{Math.round(strategy.axes[key])}</span>
        <small>{Math.round(weights[key] * 100)} % peso</small>
      </div>;
      })}
      <p>Más alto = más favorable, también en riesgo.</p>
    </div>
    <button className="reasons-toggle" aria-expanded={open} onClick={() => setExpanded(!open)}>Por qué y qué riesgos tiene<ChevronDown size={16} className={open ? 'rotate' : ''} /></button>
    {open && <div className="reasons-content">
      <h4>Por qué</h4>
      {strategy.steps?.some(step => step.reasons !== undefined) ? strategy.steps.map((step, i) => {
        const { shown, hidden } = summarizeStep(step.reasons);
        return <section className="step-reasons" key={`${step.start}-${i}`}>
        <h4>{i + 1} · {step.previousCropName ?? (i ? strategy.steps![i-1]!.cropName : 'Cultivo actual')} → {step.cropName}</h4>
        <p className="muted">{formatMonth(step.start)} a {formatMonth(step.end)}</p>
        <ReasonList reasons={shown} />
        <p className="cycle-water"><Droplets size={16} aria-hidden="true" />{waterSentence(step.water, irrigated)}</p>
        <details className="step-more"><summary>Ver más detalle</summary>
          <ReasonList reasons={hidden} />
          <p className="cycle-climate">{cycleWaterText(step.water, irrigated)}</p>
          <p className="cycle-climate">Clima del ciclo: {step.climate?.meanTemperature == null ? 'temperatura sin dato' : `${step.climate.meanTemperature.toFixed(1)} °C`} · {step.climate?.rainMm == null ? 'lluvia sin dato' : `${Math.round(step.climate.rainMm)} mm de lluvia`} · {step.climate?.cycleDays == null ? 'duración sin dato' : `${Math.round(step.climate.cycleDays)} días`}</p>
          <p className="cycle-climate">Del {formatDate(step.start)} al {formatDate(step.end)}</p>
        </details>
      </section>; }) : <ul>{strategy.reasons.filter(reason => !reason.text.startsWith('Pesos ')).map((reason, i) => <li key={i}>{reason.text}</li>)}</ul>}
      <p className="weights-note">Calculado con tus prioridades: {axes.map(axis => `${axis.label.toLowerCase()} ${Math.round(weights[axis.key]*100)} %`).join(' · ')}. Ingreso es una heurística, no un precio.</p>
      <h4>Antes de decidir</h4>
      <ul>
        {[...new Set(strategy.risks)].map((risk, i) => <li key={i}>{risk}</li>)}
      </ul>
    </div>}
    <div className="confidence">
      <span className="chip neutral-chip"><ShieldCheck size={13} />Confianza {strategy.confidence.toLowerCase()}</span>
      <div><h4>Qué sabemos</h4>
        <ul>{(strategy.known?.length ? strategy.known : ['Sin detalle del estado de las fuentes en esta respuesta.']).map(text => <li key={text}>{text}</li>)}</ul>
        <h4>Qué falta</h4>
        {strategy.missing?.length ? <ul>{strategy.missing.map(text => <li key={text}>{text}</li>)}</ul> : <p>{strategy.confidenceReason}</p>}
      </div>
    </div>
    <Notice variant="info" label="INFO · VALIDACIÓN LOCAL" title="Valida antes de sembrar"><p>{validation}</p></Notice>
  </article>;
}
export function Recommendations({ parcel }: { parcel: Parcel }) {
  const initial = useAsync(() => apiClient.getRecommendations(parcel), parcel.zoneId ?? parcel.id);
  if (initial.status === 'loading') return <LoadingState note={useMocks ? undefined : waitingNote} />;
  if (initial.status === 'error') return <EmptyState title="No pudimos calcular qué sembrar"><p>{initial.message}</p><button className="button primary" onClick={initial.retry}>Reintentar</button></EmptyState>;
  return <Advice key={parcel.zoneId ?? parcel.id} parcel={parcel} initial={initial.data} />;
}
function Advice({ parcel, initial }: { parcel: Parcel; initial: RecommendationResult }) {
  const { user } = useDemo();
  const defaults = initial.priorities ?? user?.priorities ?? { water: 25, soil: 25, income: 25, risk: 25 };
  const [weights, setWeights] = useState<Priorities>(defaults);
  const [saveMessage, setSaveMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const normalized = normalizedWeights(weights);
  const state = useAsync(() => apiClient.getRecommendations(parcel, weights), `${parcel.zoneId ?? parcel.id}:${JSON.stringify(weights)}`, 350);
  return <div className="recommendations">
    <section className="priorities" id="prioridades">
      <div className="section-heading"><div><h2>Ajusta tus prioridades</h2><p>Buscamos nuevas alternativas para los pesos elegidos. Guardar preferencias es opcional.</p></div><button className="text-button" onClick={() => setWeights(defaults)}><RotateCcw size={15} />Restablecer</button></div>
      <div className="sliders">{axes.map(({ key, label, description }) => {
        const Icon = icons[key];
        return <label key={key} className="priority-slider"><span><Icon size={18} />{label}<output>{Math.round(normalized[key] * 100)} %</output></span><small>{description}</small>
          <input type="range" min="0" max="100" step="1" value={weights[key]} aria-label={`Prioridad de ${label}`} aria-valuetext={`${weights[key]} de 100; peso normalizado ${Math.round(normalized[key] * 100)} por ciento`} onChange={event => { setSaveMessage(''); setWeights({ ...weights, [key]: Number(event.target.value) }); }} />
          <span className="slider-extremes"><small>Menos</small><small>Más</small></span></label>;
      })}</div>
      {parcel.ownerId === user?.id ? <button className="button" disabled={saving || state.status !== 'ready'} onClick={async () => {
        setSaving(true); setSaveMessage('');
        try { const saved = await apiClient.savePriorities(weights); setWeights(saved); setSaveMessage('Prioridades guardadas.'); }
        catch (e) { setSaveMessage(e instanceof Error ? e.message : 'No se pudo guardar.'); } finally { setSaving(false); }
      }}>Guardar prioridades</button> : <p className="form-note">Puedes explorar alternativas sin modificar las prioridades guardadas del dueño.</p>}
      <p role="status">{saveMessage}</p><p className="form-note">Pesos normalizados a 100 %. Ingreso usa categorías estimadas de cultivos, no ganancias ni precios en tiempo real.</p>
    </section>
    {state.status === 'loading' ? <LoadingState note="Recalculando alternativas con tus prioridades…" /> : state.status === 'error'
      ? <EmptyState title="No pudimos actualizar las recomendaciones"><p>{state.message}</p><button className="button" onClick={state.retry}>Reintentar</button></EmptyState>
      : <DecisionCards parcel={parcel} result={state.data} weights={weights} />}
  </div>;
}
function DecisionCards({ parcel, result, weights }: { parcel: Parcel; result: RecommendationResult; weights: Priorities }) {
  const mock = result.origin === 'mock';
  const normalized = normalizedWeights(result.priorities ?? weights);
  const ranked: RankedStrategy[] = mock ? rankStrategies(result.strategies, weights)
    : [...result.strategies].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map(strategy => ({ ...strategy, score: Math.round(strategy.score!), delta: strategy.delta ?? null }));
  const horizon = horizonMonths(result.horizonStart);
  const hasBaseline = ranked.some(strategy => strategy.baseline);
  const baselineWarning = result.baselineUnavailableReasons && <Notice variant="risk" label="ESTRATEGIA ACTUAL" title="Mantener lo actual no es viable"><ul>{result.baselineUnavailableReasons.map(reason => <li key={reason}>{reason}</li>)}</ul><p>Las alternativas no muestran diferencia de puntaje porque no hay referencia viable.</p></Notice>;
  if (result.status === 'no_viable_options' || !ranked.length) return <div className="no-windows">
    <CalendarDays size={32} /><h2>No encontramos cultivos viables con estas condiciones</h2>
    <p>Ningún cultivo del catálogo completa su ciclo con las condiciones calculadas para los próximos 24 meses.</p>
    <Notice variant="risk" label="SIN OPCIONES VIABLES" title="Revisa las causas antes de sembrar"><p>Conserva la cobertura del suelo y revisa agua, temperatura y duración de los ciclos con tu agrónomo. Esto no significa necesariamente que existan cero ventanas climáticas.</p></Notice>
    {baselineWarning}{result.warnings.length > 0 && <ul className="muted">{result.warnings.map(text => <li key={text}>{text}</li>)}</ul>}
  </div>;
  return <>
    {mock && <span className="chip warning-chip">Datos de ejemplo</span>}
    <div className="section-heading"><div><h2>Qué sembrar después</h2><p>{hasBaseline ? 'Compara la estrategia actual y las alternativas disponibles.' : 'Compara las mejores opciones para tu zona.'}</p></div><span className="chip neutral-chip">{horizon.range}</span></div>
    {result.risk.level === 'high' && <Notice variant="risk" label="RIESGO · CULTIVO ACTUAL" title={`${parcel.crop} corre riesgo en esta zona`}><ul>{result.risk.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul><Link className="text-button" href={parcelUrl(parcel.id, 'datos', parcel.zoneId)}>Ver datos de lluvia →</Link></Notice>}
    {baselineWarning}
    {ranked[0].baseline && <div className="baseline-wins" role="status"><Check size={18} />Con tus prioridades y los datos disponibles, mantener lo actual tiene el mayor puntaje.</div>}
    <div className="inputs-used"><span><i />Datos NASA <small>contexto climático</small></span><span><i />Tu zona <small>{parcel.irrigation ? 'con riego' : 'de temporal'} · {parcel.crop}</small></span><span><i />Prioridades <small>calculadas por el motor</small></span></div>
    <p className="sr-only" aria-live="polite">Mejor opción: {ranked[0].name}, {ranked[0].score} puntos.</p>
    <p className="comparison-hint">{ranked.length} {ranked.length === 1 ? 'estrategia' : 'estrategias'} · Desplaza para comparar →</p>
    <div className="sequence-grid" tabIndex={0} role="region" aria-label="Comparación de estrategias; usa las flechas para recorrerlas">
      {ranked.map((strategy, index) => <SequenceCard key={strategy.id} strategy={strategy} index={index} weights={normalized} horizonStart={result.horizonStart} irrigated={parcel.irrigation} />)}
    </div>
  </>;
}
