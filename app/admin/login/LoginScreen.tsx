'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useFormState, useFormStatus } from 'react-dom';
import { Mail, Lock, ArrowRight, User } from 'lucide-react';
import { signIn, registrarAdmin } from './actions';
import { AuthInput } from './AuthInput';
import { AvatarPicker } from '../(dashboard)/AvatarPicker';

/**
 * Logo grande, recortado con CSS (2026-08-31, pedido explícito: "el
 * logo está muy chico") — el archivo real (escencial-logoblanco.webp)
 * es un cuadrado de 500x500 con el wordmark ocupando solo una franja
 * fina al medio (~100px de esos 500) — a <Image> normal, cuanto más
 * "alto" se le pide, más espacio transparente de arriba/abajo se lleva
 * también, así que el texto en sí seguía viéndose chico sin importar
 * el height pedido. Esto renderiza el archivo como fondo, agrandado y
 * recortado para mostrar SOLO esa franja — mismo resultado visual que
 * tener un archivo bien recortado, sin necesitar uno nuevo.
 */
function LogoEscencial({ heightPx, className = '' }: { heightPx: number; className?: string }) {
  const escala = heightPx / 100;
  return (
    <div
      role="img"
      aria-label="Escencial"
      className={className}
      style={{
        width: 460 * escala,
        height: heightPx,
        backgroundImage: 'url(/logos/escencial-logoblanco.webp)',
        backgroundSize: `${500 * escala}px ${500 * escala}px`,
        backgroundPosition: '50% 49%',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

// Estructura clonada de AuthLayout.jsx + AuthPage.jsx (COMRURAL): split-screen,
// izquierda nítida (marca + propuesta), derecha con fondo sólido. Colores/
// tipografía: kit ONE, no el de COMRURAL.
//
// Fondo del panel izquierdo (2026-08-31, pedido explícito: "el fondo es
// feo, eliminalo y generá uno vos") — antes era una foto de stock
// (one-fondograndecolor.jpg) full-bleed; ahora es 100% CSS (.login-panel-bg,
// ver globals.css) — gradiente + dos manchas de color + textura de líneas
// finas, mismo lenguaje visual que el resto del panel admin (.admin-glow),
// sin ninguna imagen que decodificar.
function BotonSubmit({ texto, textoPendiente }: { texto: string; textoPendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-one-fucsia px-6 py-3 text-sm font-bold text-one-negro transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-one-fucsia disabled:pointer-events-none disabled:opacity-60"
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
      {/* Mismo picker que "Mi perfil"/alta de usuario, con overrides para
          fondo oscuro (2026-08-31, pedido explícito: "que se visualice
          de forma estética el ícono de perfil que puede elegir" en el
          registro) — claseTitulo clona la convención de AuthInput
          (text-one-blanco/80) y el anillo inactivo pasa de oscuro-sobre-
          oscuro (invisible acá) a blanco tenue. */}
      <AvatarPicker
        name="avatar"
        claseTitulo="text-xs font-bold tracking-wide text-one-blanco/50 uppercase"
        claseAyuda="text-one-blanco/40"
        claseAnilloInactivo="ring-one-blanco/20"
      />
      <BotonSubmit texto="Crear cuenta" textoPendiente="Creando..." />
    </form>
  );
}

// Compartido por /admin/login y por la raíz del dominio (app/page.tsx,
// 2026-08-25). El registro (`mostrarRegistro`) se ofrece desde los dos
// lugares (2026-08-31, antes solo desde la raíz — pedido explícito
// ahora: "poné para registrarse desde el login") — sigue siendo el
// mismo alta sin candado de siempre, ver registrarAdmin en actions.ts.
export function LoginScreen({ mostrarRegistro = false }: { mostrarRegistro?: boolean }) {
  const [modo, setModo] = useState<'login' | 'registro'>('login');

  return (
    <div className="relative min-h-svh overflow-hidden bg-one-oscuro md:h-svh">
      <div className="relative grid min-h-svh md:h-svh md:grid-cols-[3fr_2fr]">
        {/* Panel izquierdo — marca + propuesta, nítido. Un solo bloque
            centrado (2026-09-01, rediseño — antes el logo vivía arriba
            del todo y la copy abajo del todo, con "justify-between"
            forzando un hueco enorme y vacío en el medio en pantallas
            grandes de verdad: eso era "el logo mal puesto" que marcó
            Facundo, no el logo en sí). Ahora el logo es el primer
            elemento del MISMO bloque que el resto — se lee como una
            sola composición, no dos piezas sueltas en los extremos. */}
        <div className="login-panel-bg rise-in relative flex h-64 flex-col justify-center overflow-hidden p-6 md:h-full md:p-14">
          {/* Isotipo de ONE (2026-09-01, más chico y anclado — antes
              era un blob centrado gigantesco, ahora vive en la esquina
              como una marca de agua real, sin competir con el logo ni
              con el texto). Sigue siendo la marca de la plataforma, no
              relleno genérico — ver SISTEMA_DISENO_LANDING → "Elemento
              insignia". */}
          <Image
            src="/logos/one/logo-isotipo.webp"
            alt=""
            width={640}
            height={640}
            aria-hidden="true"
            className="pointer-events-none absolute -right-[8vmin] -bottom-[8vmin] size-[38vmin] max-w-none opacity-[0.16] mix-blend-screen md:size-[30vmin]"
          />

          <div className="relative">
            <LogoEscencial heightPx={56} />

            <div className="mt-10 hidden md:block">
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
                {[
                  { color: 'bg-one-cian', texto: 'Plantillas de landing reutilizables' },
                  { color: 'bg-one-fucsia', texto: 'Seguimiento automático por email' },
                  { color: 'bg-one-dorado', texto: 'Tracking de clicks a WhatsApp' },
                ].map((item, i) => (
                  <div
                    key={item.texto}
                    style={{ '--stagger-index': i } as React.CSSProperties}
                    className="stagger-in flex items-center gap-3 text-sm text-one-blanco/70"
                  >
                    <span className={`size-2 shrink-0 rounded-full ${item.color}`} />
                    {item.texto}
                  </div>
                ))}
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
            <LogoEscencial heightPx={48} className="mx-auto mb-8 md:hidden" />

            {/* Texto sólido acá, no gradiente (2026-09-01) — el gradient-text
                ya es el gesto del panel izquierdo ("en un solo lugar.");
                repetirlo en cada título de la pantalla es justo el patrón
                que marca la skill anti-ia (el mismo efecto especial en
                todos lados deja de leerse como especial). */}
            <h1 key={`${modo}-h1`} className="rise-in text-2xl font-extrabold text-one-blanco">
              {modo === 'login' ? 'Bienvenido' : 'Creá tu cuenta'}
            </h1>
            <p key={`${modo}-sub`} className="rise-in mt-1 text-sm text-one-lavanda">
              {modo === 'login' ? 'Ingresá tus credenciales para continuar.' : 'Acceso completo al panel de administración.'}
            </p>

            {/* key={`${modo}-form`} (2026-09-01) — antes el swap entre
                login/registro era un corte seco, sin transición. React
                desmonta/remonta el form completo al cambiar la key, y
                rise-in (misma animación de entrada que ya usa el resto del
                panel) le da una entrada real en vez de un salto. */}
            <div key={`${modo}-form`} className="rise-in">
              {modo === 'login' ? <FormLogin /> : <FormRegistro />}
            </div>

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
