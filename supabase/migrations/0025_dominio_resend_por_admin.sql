-- Verificación automática de dominio de Resend por admin (2026-08-31,
-- pedido explícito) — ver lib/dominio-resend.ts para la orquestación
-- real (Resend crea el dominio con la key del propio admin, Hostinger
-- carga los DNS que pide). Reemplaza el paso manual de "verificá tu
-- dominio en resend.com/domains antes de conectar acá" — ahora se puede
-- hacer todo desde el panel, sin que el admin necesite tocar Hostinger.
--
-- dominio_resend_id: el id que Resend le asignó al dominio (hace falta
-- para poder volver a pedir la verificación después). dominio_nombre:
-- el subdominio elegido, completo (ej. mariana.escencialconsultora.com).
-- dominio_estado: null (nunca se intentó) | 'pendiente' (creado, DNS
-- cargado, esperando que Resend confirme) | 'verificado' (listo, ya se
-- completó sender_email solo) | 'error' (algo falló, ver dominio_error).
alter table resend_accounts add column dominio_resend_id text;
alter table resend_accounts add column dominio_nombre text;
alter table resend_accounts add column dominio_estado text check (dominio_estado in ('pendiente', 'verificado', 'error'));
alter table resend_accounts add column dominio_error text;
