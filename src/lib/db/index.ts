import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Se ve claramente en dev si falta la URL de Neon en .env.local
  throw new Error(
    "DATABASE_URL no está definida. Añade tu connection string de Neon a .env.local",
  );
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });

export * as schema from "./schema";
