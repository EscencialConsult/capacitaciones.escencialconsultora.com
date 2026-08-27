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
// 2026-08-25). El registro (`mostrarRegistro`) solo se ofrece desde la
// raíz — pedido explícito 2026-08-27 ("registrarse desde inicio"), no
// desde /admin/login.
export function LoginScreen({ mostrarRegistro = false }: { mostrarRegistro?: boolean }) {
  const [modo, setModo] = useState<'login' | 'registro'>('login');

  return (
    <div className="relative min-h-svh overflow-hidden bg-one-oscuro md:h-svh">
      <div className="relative grid min-h-svh md:h-svh md:grid-cols-[3fr_2fr]">
        {/* Panel izquierdo — marca + propuesta, nítido. La foto de fondo
            vive acá adentro (no full-bleed): el panel derecho ahora es
            sólido y no la necesita atrás, así que decodificar la imagen
            en esa mitad de pantalla sería puro gasto sin nada que mostrar. */}
        <div className="rise-in relative flex h-56 flex-col justify-between overflow-hidden p-6 md:h-full md:p-12">
          <Image
            src="/images/one-fondograndecolor.jpg"
            alt=""
            fill
            priority
            quality={60}
            sizes="(min-width: 768px) 60vw, 100vw"
            className="object-cover"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-one-oscuro/90 via-one-oscuro/20 to-transparent"
            aria-hidden="true"
          />

          <div className="relative">
            <Image
              src="/logos/escencial-logoblanco.webp"
              alt="Escencial"
              width={160}
              height={40}
              className="h-9 w-auto"
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
