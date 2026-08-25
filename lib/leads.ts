import { z } from 'zod';

/**
 * Validación del formulario público de captura de leads. Coincide con
 * los campos que manda el <form> de las plantillas de landing — si se
 * agrega un campo nuevo a una plantilla, se agrega acá también.
 */
export const leadInputSchema = z.object({
  landing_id: z.string().uuid(),
  nombre: z.string().trim().min(1, 'Falta el nombre.').max(200, 'Nombre demasiado largo.'),
  apellido: z.string().trim().min(1, 'Falta el apellido.').max(200, 'Apellido demasiado largo.'),
  email: z.string().trim().email('Email inválido.').max(254, 'Email demasiado largo.'),
  phone: z.string().trim().max(200, 'Teléfono demasiado largo.').optional().default(''),
  // Solo lo manda el <select name="opcion"> de una plantilla de "envío
  // personalizado" (ver landing_templates.envio_personalizado) — en una
  // plantilla de goteo normal ese campo no existe en el HTML, así que
  // esto llega undefined y app/api/leads/route.ts lo ignora.
  opcion: z.coerce.number().int().min(1).max(4).optional(),
});

export type LeadInput = z.infer<typeof leadInputSchema>;
