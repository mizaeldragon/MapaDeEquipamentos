import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function ensureSchema() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS devices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      type text NOT NULL CHECK (type IN ('hub', 'switch', 'router', 'ap', 'server')),
      ip text,
      status text NOT NULL DEFAULT 'up' CHECK (status IN ('up', 'warn', 'down')),
      x double precision NOT NULL DEFAULT 0,
      y double precision NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  // If an older schema exists with integer x/y, upgrade to double precision.
  await pool.query(`
    ALTER TABLE devices
      ALTER COLUMN x TYPE double precision USING x::double precision,
      ALTER COLUMN y TYPE double precision USING y::double precision
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      from_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      to_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'up' CHECK (status IN ('up', 'warn', 'down')),
      label text,
      from_handle text,
      to_handle text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS links_unique
    ON links (from_id, to_id, from_handle, to_handle)
  `);
}
