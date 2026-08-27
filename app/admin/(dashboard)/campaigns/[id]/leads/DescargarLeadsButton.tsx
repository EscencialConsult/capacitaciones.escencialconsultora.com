'use client';

import { Download } from 'lucide-react';

type LeadParaExportar = {
  first_name: string | null;
  last_name: string | null;
  email: string;
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

/**
 * Descarga los leads de esta campaña como CSV (2026-08-27, pedido
 * explícito). Se arma 100% del lado del cliente a partir de los datos
 * que la pantalla ya recibió del servidor — no hace falta ningún
 * endpoint nuevo ni volver a consultar la base. `<a download>` funciona
 * normal acá (es una página real de la app, no un artifact en
 * sandbox).
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
  const descargar = () => {
    const encabezados = ['Nombre', 'Apellido', 'Email', 'Teléfono', ...(esEnvioPersonalizado ? ['Opción elegida'] : []), 'Click WhatsApp', 'Ingresó'];

    const filas = leads.map((l) => {
      const base = [
        l.first_name ?? '',
        l.last_name ?? '',
        l.email,
        l.phone ?? '',
        ...(esEnvioPersonalizado ? [l.selected_option != null ? String(l.selected_option) : ''] : []),
        l.whatsapp_clicked_at ? new Date(l.whatsapp_clicked_at).toLocaleString('es-AR') : 'No',
        new Date(l.created_at).toLocaleString('es-AR'),
      ];
      return base.map(celdaCsv).join(',');
    });

    // BOM (﻿) al principio — sin esto, Excel en Windows interpreta
    // los acentos/ñ como otra cosa (bug real de Excel con UTF-8 puro,
    // no de este código).
    const csv = '﻿' + [encabezados.map(celdaCsv).join(','), ...filas].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const nombreArchivo = `leads-${nombreCampana.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`;

    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={descargar}
      disabled={leads.length === 0}
      className="inline-flex items-center gap-2 rounded-full border border-one-oscuro/15 px-4 py-2 text-sm font-bold text-one-oscuro transition-[transform,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-one-oscuro/5 disabled:pointer-events-none disabled:opacity-40"
    >
      <Download className="size-4" strokeWidth={1.75} />
      Descargar leads
    </button>
  );
}
