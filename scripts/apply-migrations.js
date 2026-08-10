#!/usr/bin/env node
/**
 * Aplica los archivos de supabase/migrations/*.sql directo contra la
 * base de Supabase, en orden, saltando los que ya se aplicaron antes
 * (registrados en la tabla _claude_migrations). Así Facundo no vuelve
 * a pegar SQL a mano en el SQL Editor — cada migración nueva que
 * aparezca en el repo se corre sola la próxima vez que se ejecute esto.
 *
 * Uso: source .env.local && node scripts/apply-migrations.js
 * (las variables tienen que estar exportadas en el shell antes de
 * llamar a node — no usa ningún paquete de .env para no sumar otra
 * dependencia solo para esto).
 * Requiere DATABASE_URL en el entorno (postgresql://postgres:...).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

/**
 * Separa un archivo SQL en sentencias individuales, respetando strings
 * con comillas simples, comentarios de línea (--) y bloques dollar-quoted
 * ($$...$$ o $tag$...$tag$ — los usa 0002_seed.sql para el HTML/CSS de
 * las plantillas, que tiene ";" adentro y NO se puede cortar ahí).
 * Necesario porque el pooler de Supabase no soporta mandar varias
 * sentencias juntas en un solo mensaje de query.
 */
function separarSentencias(sql) {
  const sentencias = [];
  let actual = '';
  let i = 0;
  let dentroComillaSimple = false;
  let dentroComentario = false;
  let tagDolar = null; // null = no estamos en bloque dollar-quoted; string = el tag actual

  while (i < sql.length) {
    const ch = sql[i];
    const resto = sql.slice(i);

    if (dentroComentario) {
      actual += ch;
      if (ch === '\n') dentroComentario = false;
      i++;
      continue;
    }

    if (tagDolar !== null) {
      actual += ch;
      if (resto.startsWith(tagDolar)) {
        actual += tagDolar.slice(1);
        i += tagDolar.length;
        tagDolar = null;
        continue;
      }
      i++;
      continue;
    }

    if (dentroComillaSimple) {
      actual += ch;
      if (ch === "'") dentroComillaSimple = false;
      i++;
      continue;
    }

    if (ch === '-' && sql[i + 1] === '-') {
      dentroComentario = true;
      actual += ch;
      i++;
      continue;
    }

    if (ch === "'") {
      dentroComillaSimple = true;
      actual += ch;
      i++;
      continue;
    }

    const matchDolar = resto.match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)?\$/);
    if (matchDolar) {
      tagDolar = matchDolar[0];
      actual += tagDolar;
      i += tagDolar.length;
      continue;
    }

    if (ch === ';') {
      sentencias.push(actual.trim());
      actual = '';
      i++;
      continue;
    }

    actual += ch;
    i++;
  }

  if (actual.trim()) sentencias.push(actual.trim());
  return sentencias.filter((s) => s.length > 0);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Falta DATABASE_URL en .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Conectado a la base.');

  await client.query(`
    create table if not exists _claude_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows: aplicadas } = await client.query('select filename from _claude_migrations');
  const yaAplicadas = new Set(aplicadas.map((r) => r.filename));

  const archivos = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const archivo of archivos) {
    if (yaAplicadas.has(archivo)) {
      console.log(`⏭  ${archivo} — ya aplicada, se saltea`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, archivo), 'utf8');
    const sentencias = separarSentencias(sql);
    console.log(`▶  Aplicando ${archivo} (${sentencias.length} sentencias)...`);

    try {
      await client.query('begin');
      for (const sentencia of sentencias) {
        await client.query(sentencia);
      }
      await client.query('insert into _claude_migrations (filename) values ($1)', [archivo]);
      await client.query('commit');
      console.log(`✅ ${archivo} aplicada.`);
    } catch (err) {
      await client.query('rollback');
      console.error(`❌ Error en ${archivo}:`, err.message);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log('Listo — todas las migraciones al día.');
}

main().catch((err) => {
  console.error('Error de conexión:', err.message);
  process.exit(1);
});
