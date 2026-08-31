'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';

type LeadParaExportar = {
  first_name: string | null;
  last_name: string | null;
  // Nullable desde la carga masiva sin email (2026-08-31, ver migración
  // 0033) — un contacto cargado solo con teléfono.
  email: string | null;
  phone: string | null;
  selected_option: number | null;
  whatsapp_clicked_at: string | null;
  created_at: string;
};

// Envuelve en comillas y escapa comillas internas — sin esto, un nombre
// o dato con una coma adentro (ej. "Pérez, Juan") corta la fila en la
// columna equivocada al abrirlo en Excel/Sheets.
function celdaCsv(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

function encabezados(esEnvioPersonalizado: boolean): string[] {
  return ['Nombre', 'Apellido', 'Email', 'Teléfono', ...(esEnvioPersonalizado ? ['Opción elegida'] : []), 'Click WhatsApp', 'Ingresó'];
}

function filaDeLead(l: LeadParaExportar, esEnvioPersonalizado: boolean): (string | number)[] {
  return [
    l.first_name ?? '',
    l.last_name ?? '',
    l.email ?? '',
    l.phone ?? '',
    ...(esEnvioPersonalizado ? [l.selected_option != null ? String(l.selected_option) : ''] : []),
    l.whatsapp_clicked_at ? new Date(l.whatsapp_clicked_at).toLocaleString('es-AR') : 'No',
    new Date(l.created_at).toLocaleString('es-AR'),
  ];
}

function nombreArchivoBase(nombreCampana: string): string {
  return `leads-${nombreCampana.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}`;
}

function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Descarga los leads de esta campaña como CSV o XLSX (2026-08-27, pedido
 * explícito: "se puede en excel también?" — el CSV plano se rompe en
 * Excel argentino porque la config regional espera `;` como separador
 * en vez de `,`, así que se suma XLSX real como opción sin sacar el CSV).
 * Se arma 100% del lado del cliente a partir de los datos que la pantalla
 * ya recibió del servidor — no hace falta ningún endpoint nuevo ni volver
 * a consultar la base. `<a download>` funciona normal acá (es una página
 * real de la app, no un artifact en sandbox).
 */
export function DescargarLeadsButton({
  leads,
  nombreCampana,
  esEnvioPersonalizado,
}: {
  leads: LeadParaExportar[];
  nombreCampana: string;
  esEnvioPersonalizado: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [generandoXlsx, setGenerandoXlsx] = useState(false);

  const descargarCsv = () => {
    const filas = leads.map((l) => filaDeLead(l, esEnvioPersonalizado).map((v) => celdaCsv(String(v))).join(','));

    // BOM (﻿) al principio — sin esto, Excel en Windows interpreta
    // los acentos/ñ como otra cosa (bug real de Excel con UTF-8 puro,
    // no de este código).
    const csv = '﻿' + [encabezados(esEnvioPersonalizado).map(celdaCsv).join(','), ...filas].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    descargarBlob(blob, `${nombreArchivoBase(nombreCampana)}.csv`);
    setAbierto(false);
  };

  const descargarXlsx = async () => {
    setGenerandoXlsx(true);
    try {
      // Import dinámico — la librería (SheetJS) pesa varios cientos de KB
      // y solo hace falta cuando alguien efectivamente elige "Excel (.xlsx)",
      // no en cada carga de la pantalla de leads.
      const XLSX = await import('xlsx');
      const filas = leads.map((l) => filaDeLead(l, esEnvioPersonalizado));
      const hoja = XLSX.utils.aoa_to_sheet([encabezados(esEnvioPersonalizado), ...filas]);
      // Ancho de columna aproximado por contenido — sin esto todas las
      // columnas salen con el ancho por defecto de Excel y hay que
      // agrandarlas a mano para leer los emails/nombres completos.
      hoja['!cols'] = encabezados(esEnvioPersonalizado).map((_, i) => ({
        wch: Math.max(10, ...filas.map((f) => String(f[i] ?? '').length), encabezados(esEnvioPersonalizado)[i].length) + 2,
      }));
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Leads');
      const buffer = XLSX.write(libro, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      descargarBlob(blob, `${nombreArchivoBase(nombreCampana)}.xlsx`);
    } finally {
      setGenerandoXlsx(false);
      setAbierto(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={leads.length === 0}
        className="inline-flex items-center gap-2 rounded-full border border-one-oscuro/15 px-4 py-2 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-40"
      >
        <Download className="size-4" strokeWidth={1.75} />
        Descargar leads
      </button>

      {abierto && (
        <>
          {/* Overlay invisible para cerrar el menú al clickear afuera */}
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-one-sm border border-one-oscuro/10 bg-one-blanco shadow-lg">
            <button
              type="button"
              onClick={descargarCsv}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-one-oscuro transition-colors duration-150 hover:bg-one-oscuro/5"
            >
              <Download className="size-4 shrink-0 text-one-oscuro/50" strokeWidth={1.75} />
              CSV (.csv)
            </button>
            <button
              type="button"
              onClick={descargarXlsx}
              disabled={generandoXlsx}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-one-oscuro transition-colors duration-150 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-50"
            >
              <FileSpreadsheet className="size-4 shrink-0 text-one-oscuro/50" strokeWidth={1.75} />
              {generandoXlsx ? 'Generando...' : 'Excel (.xlsx)'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
