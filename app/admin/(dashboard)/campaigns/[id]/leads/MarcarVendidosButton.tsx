'use client';

import { useState } from 'react';
import { DollarSign, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import { marcarVendidosDesdeArchivo } from '../../actions';
import { inputClass, labelClass } from '../../../FormInput';
import { limpiarValorCrm, limpiarEmailCrm } from '@/lib/leads-import';

type Paso = 'cerrado' | 'archivo' | 'mapeo' | 'resumen';

type ResultadoOk = {
  ok: true;
  totalEmails: number;
  encontrados: number;
  marcados: number;
  yaEstaban: number;
  noEncontrados: number;
};
type Resultado = ResultadoOk | { error: string };

const PISTA_ESTADO = /estado|status/i;

/**
 * Marcar vendidos en lote, resubiendo el mismo tipo de export del CRM
 * (2026-08-31, pedido explícito) — hermano de SubirLeadsButton, mismo
 * patrón de subir archivo + mapear columnas, pero esto NO crea leads
 * nuevos: matchea por email contra los leads que ya existen en ESTA
 * campaña y cancela los emails pendientes de los que matchean.
 *
 * El export real de Facundo trae una columna "Estado" con valores como
 * "VENDIDA" o "SEGUIMIENTO" — mapear esa columna es opcional: si no se
 * mapea, se asume que TODAS las filas del archivo son ventas (por si
 * el admin ya filtró el archivo antes de subirlo). Si se mapea, el
 * input de al lado deja elegir qué texto exacto cuenta como "vendido"
 * (por si el CRM usa otra palabra, o cambia con el tiempo).
 */
export function MarcarVendidosButton({ campaignId }: { campaignId: string }) {
  const [paso, setPaso] = useState<Paso>('cerrado');
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [encabezados, setEncabezados] = useState<string[]>([]);
  const [filas, setFilas] = useState<string[][]>([]);
  const [colEmail, setColEmail] = useState<number | null>(null);
  const [colEstado, setColEstado] = useState<number | null>(null);
  const [valorVendido, setValorVendido] = useState('VENDIDA');
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function cerrarTodo() {
    setPaso('cerrado');
    setErrorArchivo('');
    setEncabezados([]);
    setFilas([]);
    setColEmail(null);
    setColEstado(null);
    setValorVendido('VENDIDA');
    setResultado(null);
  }

  async function onArchivoElegido(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;

    setCargandoArchivo(true);
    setErrorArchivo('');
    try {
      const XLSX = await import('xlsx');
      const buffer = await archivo.arrayBuffer();
      const libro = XLSX.read(buffer, { type: 'array' });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filasCrudas = XLSX.utils.sheet_to_json<string[]>(hoja, { header: 1, raw: false, defval: '' });

      if (filasCrudas.length < 2) {
        setErrorArchivo('El archivo no tiene filas de datos (solo encabezado, o está vacío).');
        return;
      }

      const [primeraFila, ...resto] = filasCrudas;
      const encabezadosLimpios = primeraFila.map((h, i) => String(h).trim() || `Columna ${i + 1}`);
      const filasConDato = resto.filter((f) => f.some((v) => String(v).trim() !== ''));

      if (filasConDato.length === 0) {
        setErrorArchivo('El archivo tiene encabezado pero ninguna fila con datos.');
        return;
      }

      const idxEmail = encabezadosLimpios.findIndex((h) => /correo|e-?mail/i.test(h));
      const idxEstado = encabezadosLimpios.findIndex((h) => PISTA_ESTADO.test(h));

      setEncabezados(encabezadosLimpios);
      setFilas(filasConDato);
      setColEmail(idxEmail >= 0 ? idxEmail : null);
      setColEstado(idxEstado >= 0 ? idxEstado : null);
      setPaso('mapeo');
    } catch (err) {
      console.error('Error leyendo archivo de ventas:', err);
      setErrorArchivo('No se pudo leer el archivo — ¿es un .csv o .xlsx válido?');
    } finally {
      setCargandoArchivo(false);
    }
  }

  const filasLimpias = filas.map((f) => ({
    email: colEmail != null ? limpiarEmailCrm(f[colEmail]) : null,
    estado: colEstado != null ? limpiarValorCrm(f[colEstado]) : null,
  }));

  // Sin columna de estado mapeada, se asume que TODO el archivo son
  // ventas (ver comentario de arriba). Con columna mapeada, solo las
  // filas cuyo valor coincide (sin importar mayúsculas) con lo que se
  // escribió en "valorVendido".
  const filasQueCuentan =
    colEstado == null
      ? filasLimpias
      : filasLimpias.filter((f) => f.estado?.toLowerCase() === valorVendido.trim().toLowerCase());
  const emailsAMarcar = Array.from(new Set(filasQueCuentan.map((f) => f.email).filter((e): e is string => !!e)));

  async function confirmar() {
    setProcesando(true);
    try {
      const r = await marcarVendidosDesdeArchivo(campaignId, emailsAMarcar);
      setResultado(r as Resultado);
      setPaso('resumen');
    } finally {
      setProcesando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPaso('archivo')}
        className="inline-flex items-center gap-2 rounded-full border border-one-oscuro/15 px-4 py-2 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5"
      >
        <DollarSign className="size-4" strokeWidth={1.75} />
        Marcar vendidos
      </button>

      {paso !== 'cerrado' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4 backdrop-blur-sm">
          <div className="stagger-in w-full max-w-2xl rounded-one-lg bg-one-blanco p-6 shadow-one-lg">
            {paso === 'archivo' && (
              <>
                <h2 className="text-base font-extrabold text-one-oscuro">Marcar vendidos desde archivo</h2>
                <p className="mt-1.5 text-xs text-one-oscuro/40">
                  Subí el mismo tipo de export del CRM. Se cruza por email contra los leads que ya existen en
                  esta campaña — a los que matchean se les cancelan los emails de esta campaña que todavía no
                  se mandaron. No crea leads nuevos ni toca a nadie que no esté ya cargado acá.
                </p>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-one-sm border-2 border-dashed border-one-oscuro/15 px-6 py-10 text-center transition-colors duration-150 hover:border-emerald-300 hover:bg-emerald-50/50">
                  <FileSpreadsheet className="size-8 text-one-oscuro/30" strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-one-oscuro">
                    {cargandoArchivo ? 'Leyendo archivo...' : 'Elegí un archivo .csv o .xlsx'}
                  </span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    disabled={cargandoArchivo}
                    onChange={onArchivoElegido}
                  />
                </label>
                {errorArchivo && <p className="mt-3 text-sm text-one-rojo">{errorArchivo}</p>}
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={cerrarTodo}
                    className="rounded-full px-6 py-2.5 text-sm font-bold text-one-oscuro/70 transition-colors duration-200 ease-out hover:bg-one-oscuro/5"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}

            {paso === 'mapeo' && (
              <>
                <h2 className="text-base font-extrabold text-one-oscuro">¿Cuál es la columna de email?</h2>
                <p className="mt-1.5 text-xs text-one-oscuro/40">
                  {filas.length} {filas.length === 1 ? 'fila encontrada' : 'filas encontradas'} en el archivo.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Email (obligatorio)</label>
                    <select
                      value={colEmail ?? ''}
                      onChange={(e) => setColEmail(e.target.value === '' ? null : Number(e.target.value))}
                      className={inputClass}
                    >
                      <option value="">— No usar —</option>
                      {encabezados.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Estado (opcional)</label>
                    <select
                      value={colEstado ?? ''}
                      onChange={(e) => setColEstado(e.target.value === '' ? null : Number(e.target.value))}
                      className={inputClass}
                    >
                      <option value="">— Todo el archivo son ventas —</option>
                      {encabezados.map((h, i) => (
                        <option key={i} value={i}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {colEstado != null && (
                  <div className="mt-3">
                    <label className={labelClass}>¿Qué valor de esa columna cuenta como "vendido"?</label>
                    <input
                      value={valorVendido}
                      onChange={(e) => setValorVendido(e.target.value)}
                      placeholder="VENDIDA"
                      className={inputClass}
                    />
                  </div>
                )}

                {!colEmail && colEmail !== 0 && <p className="mt-3 text-sm text-one-rojo">Elegí la columna de email.</p>}

                <p className="mt-4 text-xs text-one-oscuro/50">
                  {emailsAMarcar.length} {emailsAMarcar.length === 1 ? 'email distinto' : 'emails distintos'} se
                  van a buscar entre los leads de esta campaña.
                </p>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPaso('archivo')}
                    className="rounded-full px-6 py-2.5 text-sm font-bold text-one-oscuro/70 transition-colors duration-200 ease-out hover:bg-one-oscuro/5"
                  >
                    Volver
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={cerrarTodo}
                      className="rounded-full px-6 py-2.5 text-sm font-bold text-one-oscuro/70 transition-colors duration-200 ease-out hover:bg-one-oscuro/5"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmar}
                      disabled={colEmail == null || procesando || emailsAMarcar.length === 0}
                      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md disabled:pointer-events-none disabled:opacity-60"
                    >
                      {procesando ? 'Procesando...' : `Marcar ${emailsAMarcar.length} vendidos`}
                    </button>
                  </div>
                </div>
              </>
            )}

            {paso === 'resumen' && resultado && (
              <>
                {'error' in resultado ? (
                  <>
                    <h2 className="text-base font-extrabold text-one-oscuro">No se pudo procesar</h2>
                    <p className="mt-2 text-sm text-one-rojo">{resultado.error}</p>
                  </>
                ) : (
                  <>
                    <h2 className="flex items-center gap-2 text-base font-extrabold text-one-oscuro">
                      <Check className="size-5 text-emerald-600" strokeWidth={3} />
                      Listo
                    </h2>
                    <ul className="mt-3 space-y-1.5 text-sm text-one-oscuro/70">
                      <li>
                        <span className="font-semibold text-one-oscuro">{resultado.marcados}</span> leads
                        marcados como vendidos ahora — se les canceló lo que quedaba pendiente de esta campaña
                      </li>
                      {resultado.yaEstaban > 0 && (
                        <li>
                          <span className="font-semibold text-one-oscuro">{resultado.yaEstaban}</span> ya
                          estaban marcados de antes
                        </li>
                      )}
                      {resultado.noEncontrados > 0 && (
                        <li className="flex items-center gap-1.5">
                          <AlertTriangle className="size-4 shrink-0 text-one-oscuro/40" strokeWidth={2} />
                          <span className="font-semibold text-one-oscuro">{resultado.noEncontrados}</span> de
                          esos emails no son leads de esta campaña — no hay nada que cancelarles acá.
                        </li>
                      )}
                    </ul>
                  </>
                )}
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={cerrarTodo}
                    className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
