import { z } from 'zod';

/**
 * Validación del formulario público de captura de leads. Coincide con
 * los campos que manda el <form> de las plantillas de landing — si se
 * agrega un campo nuevo a una plantilla, se agrega acá también.
 */
export const leadInputSchema = z.object({
  landing_id: z.string().uuid(),
  nombre: z.string().trim().min(1, 'Falta el nombre.'),
  apellido: z.string().trim().min(1, 'Falta el apellido.'),
  email: z.string().trim().email('Email inválido.'),
  phone: z.string().trim().optional().default(''),
});

export type LeadInput = z.infer<typeof leadInputSchema>;
