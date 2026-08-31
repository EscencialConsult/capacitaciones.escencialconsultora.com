'use client';

import { useState } from 'react';
import { Upload, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';
import { importarLeads } from '../../actions';
import { inputClass, labelClass } from '../../../FormInput';
import { adivinarMapeo, limpiarValorCrm, limpiarEmailCrm, type CampoLead } from '@/lib/leads-import';

type Paso = 'cerrado' | 'archivo' | 'mapeo' | 'resumen';

type ResultadoOk = {
  ok: true;
  total: number;
  nuevos: number;
  duplicados: number;
  sinEmail: number;
  sinCredito: boolean;
  noProcesados: number;
};
type Resultado = ResultadoOk | { error: string };

const CAMPOS: { key: CampoLead; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'nombre', label: 'Nombre' },
  { key: 'apellido', label: 'Apellido' },
  { key: 'telefono', label: 'Teléfono' },
];

const MAPEO_VACIO: Record<CampoLead, number | null> = { email: null, nombre: null, apellido: null, telefono: null };

/**
 * Carga masiva de leads desde CSV/Excel (2026-08-31, pedido explícito:
 * "así como está hecho ahora pero el leads, lo cargo yo") — simétrico a
 * DescargarLeadsButton (ahí bajás, acá subís). Todo el parseo pasa acá,
 * del lado del cliente (misma librería que ya usa la descarga) — el
 * server action solo recibe filas ya limpias y mapeadas, sin tener que
 * conocer el formato de ningún CRM en particular (ver lib/leads-import.ts).
 *
 * Mapeo de columnas en vez de encabezados fijos: cada CRM exporta con
 * sus propios nombres de columna (y pueden cambiar), así que en vez de
 * adivinar mal en silencio, se le muestran al admin las columnas reales
 * del archivo para que confirme o corrija a qué corresponde cada una.
 */
export function SubirLeadsButton({
  campaignId,
  estaActiva,
  esEnvioPersonalizado,
}: {
  campaignId: string;
  estaActiva: boolean;
  esEnvioPersonalizado: boolean;
}) {
  const [paso, setPaso] = useState<Paso>('cerrado');
  const [cargandoArchivo, setCargandoArchivo] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [encabezados, setEncabezados] = useState<string[]>([]);
  const [filas, setFilas] = useState<string[][]>([]);
  const [mapeo, setMapeo] = useState<Record<CampoLead, number | null>>(MAPEO_VACIO);
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const deshabilitado = !estaActiva || esEnvioPersonalizado;
  const motivoDeshabilitado = !estaActiva
    ? 'Activá la campaña primero — la carga masiva necesita que esté activa para agendar bien las fechas de los emails.'
    : 'Esta campaña es de envío personalizado (el lead elige una opción) — la carga masiva todavía no está disponible para este tipo.';

  function cerrarTodo() {
    setPaso('cerrado');
    setErrorArchivo('');
    setEncabezados([]);
    setFilas([]);
    setMapeo(MAPEO_VACIO);
    setResultado(null);
  }

  async function onArchivoElegido(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo si hay que corregir algo
    if (!archivo) return;

    setCargandoArchivo(true);
    setErrorArchivo('');
    try {
      // Import dinámico — igual que en DescargarLeadsButton, SheetJS pesa
      // varios cientos de KB y solo hace falta cuando alguien de verdad
      // sube un archivo.
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

      setEncabezados(encabezadosLimpios);
      setFilas(filasConDato);
      setMapeo(adivinarMapeo(encabezadosLimpios));
      setPaso('mapeo');
    } catch (err) {
      console.error('Error leyendo archivo de leads:', err);
      setErrorArchivo('No se pudo leer el archivo — ¿es un .csv o .xlsx válido?');
    } finally {
      setCargandoArchivo(false);
    }
  }

  function filaLimpia(fila: string[]) {
    return {
      email: mapeo.email != null ? limpiarEmailCrm(fila[mapeo.email]) : null,
      nombre: mapeo.nombre != null ? limpiarValorCrm(fila[mapeo.nombre]) : null,
      apellido: mapeo.apellido != null ? limpiarValorCrm(fila[mapeo.apellido]) : null,
      telefono: mapeo.telefono != null ? limpiarValorCrm(fila[mapeo.telefono]) : null,
    };
  }

  const filasLimpias = filas.map(filaLimpia);
  const conEmail = filasLimpias.filter((f) => f.email).length;
  const filasUtiles = filasLimpias.filter((f) => f.email || f.nombre || f.apellido || f.telefono);
  const hayAlgunMapeo = Object.values(mapeo).some((v) => v != null);

  async function confirmarImportacion() {
    setImportando(true);
    try {
      const r = await importarLeads(campaignId, filasUtiles);
      setResultado(r as Resultado);
      setPaso('resumen');
    } finally {
      setImportando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => !deshabilitado && setPaso('archivo')}
        disabled={deshabilitado}
        title={deshabilitado ? motivoDeshabilitado : undefined}
        className="inline-flex items-center gap-2 rounded-full border border-one-oscuro/15 px-4 py-2 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-40"
      >
        <Upload className="size-4" strokeWidth={1.75} />
        Cargar leads
      </button>

      {paso !== 'cerrado' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-one-oscuro/60 p-4 backdrop-blur-sm">
          <div className="stagger-in w-full max-w-2xl rounded-one-lg bg-one-blanco p-6 shadow-one-lg">
            {paso === 'archivo' && (
              <>
                <h2 className="text-base font-extrabold text-one-oscuro">Cargar leads desde archivo</h2>
                <p className="mt-1.5 text-xs text-one-oscuro/40">
                  Subí el CSV o Excel que exporta tu CRM — en el siguiente paso elegís qué columna es cada
                  dato, no hace falta que los encabezados coincidan con nada de acá. Si podés elegir, subí el
                  .xlsx en vez del .csv: algunos exportadores guardan mal los acentos en .csv y el .xlsx no
                  tiene ese problema.
                </p>
                <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-one-sm border-2 border-dashed border-one-oscuro/15 px-6 py-10 text-center transition-colors duration-150 hover:border-one-fucsia/40 hover:bg-one-fucsia/5">
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
                <h2 className="text-base font-extrabold text-one-oscuro">¿Qué columna es cada dato?</h2>
                <p className="mt-1.5 text-xs text-one-oscuro/40">
                  {filas.length} {filas.length === 1 ? 'fila encontrada' : 'filas encontradas'} en el archivo.
                  Se adivinó un mapeo por el nombre de cada columna — corregilo si hace falta.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {CAMPOS.map((campo) => (
                    <div key={campo.key}>
                      <label className={labelClass}>{campo.label}</label>
                      <select
                        value={mapeo[campo.key] ?? ''}
                        onChange={(e) =>
                          setMapeo((m) => ({ ...m, [campo.key]: e.target.value === '' ? null : Number(e.target.value) }))
                        }
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
                  ))}
                </div>

                {!hayAlgunMapeo && <p className="mt-3 text-sm text-one-rojo">Elegí al menos una columna.</p>}

                {hayAlgunMapeo && (
                  <div className="mt-4 overflow-x-auto rounded-one-sm border border-one-oscuro/10">
                    <table className="w-full text-xs">
                      <thead className="bg-one-oscuro/5 text-left font-semibold text-one-oscuro/60">
                        <tr>
                          {CAMPOS.map((c) => (
                            <th key={c.key} className="px-3 py-2">
                              {c.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filasLimpias.slice(0, 5).map((f, i) => (
                          <tr key={i} className="border-t border-one-oscuro/5">
                            {CAMPOS.map((c) => (
                              <td key={c.key} className="px-3 py-2 text-one-oscuro/70">
                                {f[c.key] ?? <span className="text-one-oscuro/30">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="mt-3 text-xs text-one-oscuro/50">
                  {conEmail} de {filas.length} filas tienen email — esas son las que reciben la cadencia de
                  esta campaña.
                  {filas.length - conEmail > 0 &&
                    ` Las ${filas.length - conEmail} restantes se guardan igual, sin recibir ningún email (no hay a dónde mandarles nada).`}
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
                      onClick={confirmarImportacion}
                      disabled={!hayAlgunMapeo || importando || filasUtiles.length === 0}
                      className="rounded-full bg-one-fucsia px-6 py-2.5 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-one-md disabled:pointer-events-none disabled:opacity-60"
                    >
                      {importando
                        ? 'Cargando...'
                        : `Cargar ${filasUtiles.length} ${filasUtiles.length === 1 ? 'lead' : 'leads'}`}
                    </button>
                  </div>
                </div>
              </>
            )}

            {paso === 'resumen' && resultado && (
              <>
                {'error' in resultado ? (
                  <>
                    <h2 className="text-base font-extrabold text-one-oscuro">No se pudo cargar</h2>
                    <p className="mt-2 text-sm text-one-rojo">{resultado.error}</p>
                  </>
                ) : (
                  <>
                    <h2 className="flex items-center gap-2 text-base font-extrabold text-one-oscuro">
                      <Check className="size-5 text-emerald-600" strokeWidth={3} />
                      Carga terminada
                    </h2>
                    <ul className="mt-3 space-y-1.5 text-sm text-one-oscuro/70">
                      <li>
                        <span className="font-semibold text-one-oscuro">{resultado.nuevos}</span> leads nuevos
                        cargados
                      </li>
                      <li>
                        <span className="font-semibold text-one-oscuro">{resultado.duplicados}</span> ya
                        existían en esta campaña (se saltearon, no se les mandó nada de nuevo)
                      </li>
                      {resultado.sinEmail > 0 && (
                        <li>
                          <span className="font-semibold text-one-oscuro">{resultado.sinEmail}</span> sin
                          email — guardados, sin recibir la cadencia
                        </li>
                      )}
                      {resultado.sinCredito && (
                        <li className="flex items-center gap-1.5 font-semibold text-one-rojo">
                          <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
                          Se cortó por falta de crédito disponible este ciclo — quedaron{' '}
                          {resultado.noProcesados} filas sin cargar. Volvé a subir el archivo cuando tengas
                          crédito de nuevo (los que ya se cargaron no se van a duplicar).
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
