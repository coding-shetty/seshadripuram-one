import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
const client = createClient(authToken ? { url, authToken } : { url });

export const db = drizzle(client, { schema });

export function closeDatabase(): void {
  client.close();
}
