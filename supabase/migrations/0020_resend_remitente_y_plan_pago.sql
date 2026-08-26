-- resend_accounts nunca tuvo remitente propio porque Resend todavía no
-- se usaba para mandar nada real — ahora que sí (ver process-pending.ts)
-- necesita su propio sender_email/sender_name, igual que brevo_accounts.
-- Nullable porque la fila que ya existe se conectó antes de esto — se
-- backfillea con el remitente real ya verificado (onelabs.pro,
-- confirmado con un envío de prueba) para no dejarla en un estado a
-- medio migrar.
alter table resend_accounts add column sender_email text;
alter table resend_accounts add column sender_name text;

update resend_accounts
set sender_email = coalesce(sender_email, 'noreply@onelabs.pro'),
    sender_name = coalesce(sender_name, 'Escencial Consultora')
where sender_email is null;
