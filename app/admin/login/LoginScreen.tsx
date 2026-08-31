'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useFormState, useFormStatus } from 'react-dom';
import { Mail, Lock, ArrowRight, User } from 'lucide-react';
import { signIn, registrarAdmin } from './actions';
import { AuthInput } from './AuthInput';

// Estructura clonada de AuthLayout.jsx + AuthPage.jsx (COMRURAL): split-screen
// con una foto de fondo cubriendo todo el panel, izquierda nítida (marca +
// propuesta), derecha tapada con vidrio translúcido (glassmorphism) para
// que el form sea legible. Colores/tipografía: kit ONE, no el de COMRURAL.
function BotonSubmit({ texto, textoPendiente }: { texto: string; textoPendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-one-fucsia px-6 py-3 text-sm font-bold text-one-negro transition-transform duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60"
    >
      {pending ? (
        textoPendiente
      ) : (
        <>
          {texto}
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </>
      )}
    </button>
  );
}

function FormLogin() {
  const [state, formAction] = useFormState(signIn, undefined);
  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-one-sm border border-one-rojo/40 bg-one-rojo/10 px-3 py-2 text-sm text-one-blanco">
          {state.error}
        </p>
      )}
      <AuthInput icon={Mail} id="email" name="email" label="Email" type="email" required autoComplete="username" placeholder="tu@email.com" />
      <AuthInput icon={Lock} id="password" name="password" label="Contraseña" type="password" required autoComplete="current-password" placeholder="Tu contraseña" />
      <BotonSubmit texto="Entrar" textoPendiente="Entrando..." />
    </form>
  );
}

// Sin candado, a propósito (2026-08-27, pedido explícito) — cualquiera
// que complete esto se crea una cuenta de administrador con acceso
// completo al panel. Facundo lo eligió después de que le expliqué el
// riesgo real (no hay invitación ni aprobación de por medio).
function FormRegistro() {
  const [state, formAction] = useFormState(registrarAdmin, undefined);
  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      {state?.error && (
        <p className="rounded-one-sm border border-one-rojo/40 bg-one-rojo/10 px-3 py-2 text-sm text-one-blanco">
          {state.error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <AuthInput icon={User} id="nombre" name="nombre" label="Nombre" required autoComplete="given-name" placeholder="Tu nombre" />
        <AuthInput id="apellido" name="apellido" label="Apellido" required autoComplete="family-name" placeholder="Tu apellido" />
      </div>
      <AuthInput icon={Mail} id="reg_email" name="email" label="Email" type="email" required autoComplete="username" placeholder="tu@email.com" />
      <AuthInput icon={Lock} id="reg_password" name="password" label="Contraseña" type="password" required minLength={6} autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
      <BotonSubmit texto="Crear cuenta" textoPendiente="Creando..." />
    </form>
  );
}

// Compartido por /admin/login y por la raíz del dominio (app/page.tsx,
// 2026-08-25). El registro ya se ofrece en las dos entradas (2026-08-28):
// como el alta también está abierta desde la raíz sin candado, ocultarla
// acá no sumaba seguridad real, solo confundía a quien entra por la ruta
// secreta — que es la que un admin usa todos los días.
export function LoginScreen({ mostrarRegistro = true }: { mostrarRegistro?: boolean }) {
  const [modo, setModo] = useState<'login' | 'registro'>('login');

  return (
    <div className="relative min-h-svh overflow-hidden bg-one-oscuro md:h-svh">
      <div className="relative grid min-h-svh md:h-svh md:grid-cols-[3fr_2fr]">
        {/* Panel izquierdo — marca + propuesta, nítido. Fondo propio (sin
            foto de stock): gradiente radial tricolor de la marca ONE sobre
            oscuro + una textura hexagonal sutil, todo CSS — no depende de
            decodificar ninguna imagen pesada para esta mitad de pantalla. */}
        <div className="rise-in relative flex h-56 flex-col justify-between overflow-hidden bg-one-oscuro p-6 md:h-full md:p-12">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(1100px 650px at 75% 20%, rgba(225,123,215,.22), transparent 55%),
                radial-gradient(900px 600px at 10% 75%, rgba(107,225,227,.16), transparent 55%),
                radial-gradient(650px 500px at 50% 100%, rgba(228,199,106,.12), transparent 60%),
                linear-gradient(180deg, #0a0810, #1a181d)
              `,
            }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='260' height='150'%3E%3Cg fill='none' stroke='%23fefeff' stroke-width='1'%3E%3Cpath d='M50 20l20-12 20 12v24l-20 12-20-12z'/%3E%3Cpath d='M120 20l20-12 20 12v24l-20 12-20-12z'/%3E%3Cpath d='M190 20l20-12 20 12v24l-20 12-20-12z'/%3E%3Cpath d='M85 55l20-12 20 12v24l-20 12-20-12z'/%3E%3Cpath d='M155 55l20-12 20 12v24l-20 12-20-12z'/%3E%3Cpath d='M50 90l20-12 20 12v24l-20 12-20-12z'/%3E%3Cpath d='M120 90l20-12 20 12v24l-20 12-20-12z'/%3E%3Cpath d='M190 90l20-12 20 12v24l-20 12-20-12z'/%3E%3C/g%3E%3C/svg%3E\")",
              backgroundSize: '260px 150px',
            }}
            aria-hidden="true"
          />

          <div className="relative">
            <Image
              src="/logos/escencial-logoblanco.webp"
              alt="Escencial"
              width={240}
              height={60}
              className="h-14 w-auto md:h-16"
              priority
            />
          </div>

          <div className="relative hidden md:block">
            <p className="mb-4 inline-block rounded-full border border-one-cian/25 bg-one-cian/10 px-3.5 py-1 text-xs font-bold tracking-widest text-one-cian uppercase">
              Panel de administración
            </p>
            <h2 className="max-w-md text-3xl leading-tight font-extrabold tracking-tight text-one-blanco lg:text-4xl">
              Landings y emails
              <br />
              <span className="bg-gradient-to-r from-one-fucsia to-one-cian bg-clip-text text-transparent">
                en un solo lugar.
              </span>
            </h2>
            <p className="mt-3 max-w-sm text-sm font-medium text-one-blanco/70">
              Creá landings desde plantillas reutilizables, seguí a los leads y automatizá el
              seguimiento por email — todo desde acá.
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm text-one-blanco/70">
                <span className="size-2 shrink-0 rounded-full bg-one-cian" />
                Plantillas de landing reutilizables
              </div>
              <div className="flex items-center gap-3 text-sm text-one-blanco/70">
                <span className="size-2 shrink-0 rounded-full bg-one-fucsia" />
                Seguimiento automático por email
              </div>
              <div className="flex items-center gap-3 text-sm text-one-blanco/70">
                <span className="size-2 shrink-0 rounded-full bg-one-dorado" />
                Tracking de clicks a WhatsApp
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho — form. Fondo sólido, SIN backdrop-blur: ese filtro
            fuerza al navegador a recalcular el desenfoque de la foto de
            atrás en cada repintado, y el cursor de texto parpadeando
            mientras se escribe repinta todo el tiempo — eso es lag real
            al tipear, no solo una sensación. Mismo look oscuro, sin el
            costo. */}
        <div className="rise-in relative flex flex-col overflow-y-auto bg-one-oscuro px-6 py-8 md:px-14 md:py-12">
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
            <Image
              src="/logos/escencial-logoblanco.webp"
              alt="Escencial"
              width={140}
              height={36}
              className="mx-auto mb-8 h-8 w-auto md:hidden"
            />

            <h1 className="bg-gradient-to-r from-one-fucsia to-one-cian bg-clip-text text-2xl font-extrabold text-transparent">
              {modo === 'login' ? 'Bienvenido' : 'Creá tu cuenta'}
            </h1>
            <p className="mt-1 text-sm text-one-lavanda">
              {modo === 'login' ? 'Ingresá tus credenciales para continuar.' : 'Acceso completo al panel de administración.'}
            </p>

            {modo === 'login' ? <FormLogin /> : <FormRegistro />}

            {mostrarRegistro && (
              <button
                type="button"
                onClick={() => setModo((m) => (m === 'login' ? 'registro' : 'login'))}
                className="mt-6 text-center text-sm font-semibold text-one-lavanda transition-colors duration-150 hover:text-one-fucsia"
              >
                {modo === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
