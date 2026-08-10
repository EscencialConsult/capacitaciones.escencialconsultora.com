-- Datos de arranque: categorías, una plantilla de landing, una plantilla
-- de email (migrada literal del sistema viejo), y una landing de prueba
-- para poder probar el flujo completo apenas esté todo conectado.
--
-- Con el proyecto de Supabase conectado a GitHub (Project Settings >
-- Integrations > GitHub), esta migración se aplica sola en cada push a
-- main, en orden después de 0001_init.sql — no hace falta pegarla a
-- mano en el SQL Editor. Si todavía no conectaste esa integración, sí
-- hace falta pegarla manualmente una vez, DESPUÉS de 0001_init.sql.

-- ── Categorías ──────────────────────────────────────────────────────
insert into landing_categories (id, slug, name) values
  ('00000000-0000-0000-0000-000000000001', 'servicios', 'Servicios'),
  ('00000000-0000-0000-0000-000000000002', 'capacitaciones', 'Capacitaciones');

-- ── Plantilla de landing ────────────────────────────────────────────
-- Placeholders editables (declarados en variables_schema): {{titulo}},
-- {{subtitulo}}, {{boton_texto}}. El placeholder {{__landing_id__}} es
-- reservado del sistema — lo completa siempre el renderer en
-- app/[slug]/route.ts, nunca se edita a mano ni aparece en variables_schema.
insert into landing_templates (id, name, category_id, html_content, variables_schema) values (
  '10000000-0000-0000-0000-000000000001',
  'Landing base — azul',
  '00000000-0000-0000-0000-000000000001',
  $$<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{{titulo}}</title>
<style>
  :root {
    --azul: #1a4fd6;
    --azul-oscuro: #0f2f7a;
    --gris-texto: #2b2b33;
    --fondo: #f6f7fb;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    background: var(--fondo);
    color: var(--gris-texto);
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }
  .card {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 10px 40px rgba(15, 47, 122, 0.12);
    padding: 40px;
    max-width: 440px;
    width: 100%;
  }
  h1 { font-size: 1.5rem; margin-bottom: 8px; }
  p.subtitulo { color: #666; margin-bottom: 28px; font-size: 0.95rem; }
  label { display: block; font-size: 0.85rem; font-weight: 600; margin: 16px 0 6px; }
  input {
    width: 100%;
    padding: 12px 14px;
    border: 1px solid #dcdfe6;
    border-radius: 10px;
    font-size: 1rem;
  }
  input:focus { outline: none; border-color: var(--azul); }
  button {
    width: 100%;
    margin-top: 24px;
    padding: 14px;
    border: none;
    border-radius: 10px;
    background: var(--azul);
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
  }
  button:hover { background: var(--azul-oscuro); }
  button:disabled { opacity: 0.6; cursor: not-allowed; }
  #mensaje { margin-top: 18px; font-size: 0.9rem; text-align: center; display: none; }
  #mensaje.ok { color: #1a7a3a; display: block; }
  #mensaje.error { color: #b3261e; display: block; }
</style>
</head>
<body>
<div class="card">
  <h1>{{titulo}}</h1>
  <p class="subtitulo">{{subtitulo}}</p>
  <form id="form-lead">
    <input type="hidden" name="landing_id" value="{{__landing_id__}}">
    <label for="nombre">Nombre</label>
    <input type="text" id="nombre" name="nombre" required>
    <label for="apellido">Apellido</label>
    <input type="text" id="apellido" name="apellido" required>
    <label for="email">Email</label>
    <input type="email" id="email" name="email" required>
    <label for="telefono">Teléfono (opcional)</label>
    <input type="tel" id="telefono" name="phone">
    <button type="submit" id="btn-enviar">{{boton_texto}}</button>
    <div id="mensaje"></div>
  </form>
</div>
<script>
  const form = document.getElementById('form-lead');
  const boton = document.getElementById('btn-enviar');
  const mensaje = document.getElementById('mensaje');
  const textoOriginal = boton.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    boton.disabled = true;
    boton.textContent = 'Enviando...';
    mensaje.style.display = 'none';

    const datos = Object.fromEntries(new FormData(form));

    try {
      const resp = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      const data = await resp.json();

      if (data.ok) {
        mensaje.textContent = data.duplicado
          ? 'Ya estabas registrado. ¡Gracias!'
          : '¡Listo! En breve nos contactamos.';
        mensaje.className = 'ok';
        form.reset();
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (err) {
      mensaje.textContent = 'Hubo un problema al enviar. Probá de nuevo en un momento.';
      mensaje.className = 'error';
      console.error(err);
    } finally {
      boton.disabled = false;
      boton.textContent = textoOriginal;
    }
  });
</script>
</body>
</html>$$,
  '[
    {"key": "titulo", "label": "Título principal", "type": "text"},
    {"key": "subtitulo", "label": "Subtítulo", "type": "text"},
    {"key": "boton_texto", "label": "Texto del botón", "type": "text"}
  ]'::jsonb
);

-- ── Plantilla de email ──────────────────────────────────────────────
-- Migrada literal de archive/templates-email/design-base-1/email.html —
-- mismos placeholders, cero reescritura de la lógica de reemplazo.
insert into email_templates (id, name, html_content) values (
  '20000000-0000-0000-0000-000000000001',
  'Email base — Diseño 1',
  $$<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Escencial Consultora</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f8; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f8; padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background-color:#ffffff; border-radius:12px; overflow:hidden;">
          <tr>
            <td style="background-color:#1a4fd6; padding:24px 32px;">
              <span style="color:#ffffff; font-size:18px; font-weight:bold;">Escencial Consultora</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; font-size:16px; color:#2b2b33;">
                Hola {{nombre}} {{apellido}},
              </p>
              <div style="font-size:15px; line-height:1.6; color:#2b2b33;">
                {{contenido}}
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
                <tr>
                  <td align="center" style="border-radius:8px; background-color:#25D366;">
                    <a href="{{whatsapp_url}}"
                       style="display:inline-block; padding:14px 28px; font-size:15px; font-weight:bold; color:#ffffff; text-decoration:none;">
                      Hablar por WhatsApp
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0; font-size:13px; color:#777;">
                — {{asesora_nombre}}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px; background-color:#f0f1f5;">
              <p style="margin:0; font-size:11px; color:#9a9a9a; text-align:center;">
                Escencial Consultora — Este email fue enviado porque dejaste tus datos en una de nuestras landings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>$$
);

-- ── Cuenta de Brevo (metadata — la API key va en Netlify, no acá) ──
insert into brevo_accounts (id, name, env_var_name, sender_email, sender_name, is_active) values (
  '30000000-0000-0000-0000-000000000001',
  'Cuenta principal',
  'BREVO_API_KEY_1',
  'info@capacitaciones.escencialconsultora.com',
  'Escencial Consultora',
  true
);

-- ── Landing de prueba ───────────────────────────────────────────────
insert into landings (
  id, slug, name, template_id, variables, status, advisor_name, whatsapp_number, whatsapp_message
) values (
  '40000000-0000-0000-0000-000000000001',
  'prueba',
  'Landing de prueba',
  '10000000-0000-0000-0000-000000000001',
  '{"titulo": "Quiero recibir la información", "subtitulo": "Dejanos tus datos y te contactamos.", "boton_texto": "Enviar"}'::jsonb,
  'active',
  'Facundo',
  '5493816643996',
  'Hola, quiero más info sobre la campaña'
);

insert into landing_email_steps (
  landing_id, step_number, email_template_id, offset_days, subject, content
) values (
  '40000000-0000-0000-0000-000000000001',
  1,
  '20000000-0000-0000-0000-000000000001',
  0,
  'Recibimos tu consulta',
  'Gracias por tu interés. Un asesor se va a contactar a la brevedad.'
);
