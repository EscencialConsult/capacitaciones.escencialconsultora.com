/**
 * Gráficos de /admin/ventas (2026-09-01, pedido explícito: "vos decidí
 * qué gráficos usarás") — construidos siguiendo la skill de dataviz
 * del proyecto: la forma la elige el TRABAJO del dato (ranking = barra
 * horizontal con UN color, dos series = barra agrupada con color
 * categórico, parte-de-un-todo = UNA barra apilada — nunca una torta,
 * ver choosing-a-form), y los colores de marca (fucsia/cian/dorado) se
 * ajustan a versiones más saturadas/oscuras específicas para gráficos
 * — el hex de marca tal cual falla el validador de contraste sobre
 * fondo claro (ver scripts/validate_palette.js de la skill; las
 * variantes de abajo pasan las 5 verificaciones).
 *
 * Server Components a propósito, sin 'use client' — el hover con
 * `title` nativo alcanza para el tooltip (mismo patrón que el resto
 * del panel, ver la columna "Crédito" de Campañas) sin gastar JS del
 * lado del cliente para algo que no lo necesita.
 */

export const CHART_COLORS = {
  fucsia: '#c94dc0',
  cian: '#1fb3b6',
  dorado: '#c99a2e',
  rojo: '#e2445c',
};

function EstadoVacio({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-one-oscuro/40">{children}</p>;
}

/** Ranking: una sola serie, comparando magnitud entre categorías — un solo color (sequential), la barra más larga ya dice cuál gana. */
export function BarrasHorizontales({
  datos,
  color = CHART_COLORS.fucsia,
  formatear = (n: number) => n.toLocaleString('es-AR'),
  vacio = 'Todavía no hay datos.',
}: {
  datos: { etiqueta: string; valor: number }[];
  color?: string;
  formatear?: (n: number) => string;
  vacio?: string;
}) {
  if (datos.length === 0) return <EstadoVacio>{vacio}</EstadoVacio>;
  const max = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <div className="flex flex-col gap-3">
      {datos.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-sm text-one-oscuro/80 sm:w-48" title={d.etiqueta}>
            {d.etiqueta}
          </span>
          <div className="h-4 flex-1 rounded-full bg-one-oscuro/[0.04]">
            <div
              className="h-4"
              style={{
                width: `${Math.max((d.valor / max) * 100, 2)}%`,
                backgroundColor: color,
                borderRadius: '0 4px 4px 0',
              }}
              title={`${d.etiqueta}: ${formatear(d.valor)}`}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-sm font-bold text-one-oscuro">{formatear(d.valor)}</span>
        </div>
      ))}
    </div>
  );
}

/** Dos series por categoría (ej. leads vs. ventas confirmadas) — mismo eje (las dos son "cantidad"), color categórico porque acá SÍ hay que distinguir series, no solo magnitud. Legend obligatoria (2 series). */
export function BarrasComparativas({
  datos,
  series,
  vacio = 'Todavía no hay datos.',
}: {
  datos: { etiqueta: string; valores: number[] }[];
  series: { nombre: string; color: string }[];
  vacio?: string;
}) {
  if (datos.length === 0) return <EstadoVacio>{vacio}</EstadoVacio>;
  const max = Math.max(...datos.flatMap((d) => d.valores), 1);
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.nombre} className="flex items-center gap-1.5 text-xs font-semibold text-one-oscuro/70">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.nombre}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        {datos.map((d, i) => (
          <div key={i}>
            <p className="mb-1 truncate text-sm text-one-oscuro/80" title={d.etiqueta}>
              {d.etiqueta}
            </p>
            <div className="flex flex-col gap-1">
              {d.valores.map((v, j) => (
                <div key={j} className="flex items-center gap-2">
                  <div className="h-3 flex-1 rounded-full bg-one-oscuro/[0.04]">
                    <div
                      className="h-3"
                      style={{
                        width: `${Math.max((v / max) * 100, v > 0 ? 1.5 : 0)}%`,
                        backgroundColor: series[j]?.color,
                        borderRadius: '0 4px 4px 0',
                      }}
                      title={`${series[j]?.nombre} — ${d.etiqueta}: ${v}`}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs font-bold text-one-oscuro">{v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Parte-de-un-todo — UNA barra apilada (nunca una torta, ver choosing-a-form.md), con 2px de separación real entre segmentos. */
export function BarraApilada({
  segmentos,
  vacio = 'Todavía no hay datos.',
}: {
  segmentos: { etiqueta: string; valor: number; color: string }[];
  vacio?: string;
}) {
  const total = segmentos.reduce((acc, s) => acc + s.valor, 0);
  if (total === 0) return <EstadoVacio>{vacio}</EstadoVacio>;
  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-one-oscuro/[0.04]">
        {segmentos.map(
          (s, i) =>
            s.valor > 0 && (
              <div
                key={i}
                style={{ width: `${(s.valor / total) * 100}%`, backgroundColor: s.color }}
                className={i > 0 ? 'ml-0.5' : ''}
                title={`${s.etiqueta}: ${s.valor} (${Math.round((s.valor / total) * 100)}%)`}
              />
            )
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-4">
        {segmentos.map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs font-semibold text-one-oscuro/70">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            {s.etiqueta} — {s.valor}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Tendencia en el tiempo — línea + área tenue (10% opacidad, nunca un bloque saturado), un punto por día con su propio tooltip nativo. */
export function TendenciaLinea({
  datos,
  color = CHART_COLORS.fucsia,
  vacio = 'Todavía no hay ventas confirmadas para graficar una tendencia.',
}: {
  datos: { fecha: string; valor: number }[];
  color?: string;
  vacio?: string;
}) {
  if (datos.length === 0) return <EstadoVacio>{vacio}</EstadoVacio>;

  const W = 600;
  const H = 160;
  const PAD = 20;
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const puntos = datos.map((d, i) => {
    const x = datos.length === 1 ? W / 2 : PAD + (i / (datos.length - 1)) * (W - PAD * 2);
    const y = H - PAD - (d.valor / max) * (H - PAD * 2);
    return { x, y, ...d };
  });
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${linea} L ${puntos[puntos.length - 1].x.toFixed(1)} ${H - PAD} L ${puntos[0].x.toFixed(1)} ${H - PAD} Z`;

  // Label selectivo (2026-09-01, ver marks-and-anatomy.md — "nunca un
  // número en cada punto"): solo el pico y el último punto, apoyados
  // en el tooltip nativo para el resto — nunca solo tooltip, ver
  // anti-patterns.md.
  const idxPico = puntos.reduce((mejor, p, i) => (p.valor > puntos[mejor].valor ? i : mejor), 0);
  const idxUltimo = puntos.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Ventas confirmadas por día">
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#1a181d" strokeOpacity={0.08} strokeWidth={1} />
      {puntos.length > 1 && <path d={area} fill={color} fillOpacity={0.1} stroke="none" />}
      <path d={linea} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {puntos.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill={color} stroke="#fefeff" strokeWidth={2}>
          <title>{`${p.fecha}: ${p.valor} ${p.valor === 1 ? 'venta' : 'ventas'}`}</title>
        </circle>
      ))}
      {[idxPico, idxUltimo]
        .filter((idx, i, arr) => arr.indexOf(idx) === i)
        .map((idx) => (
          <text
            key={idx}
            x={puntos[idx].x}
            y={Math.max(puntos[idx].y - 10, 12)}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#1a181d"
          >
            {puntos[idx].valor}
          </text>
        ))}
    </svg>
  );
}
