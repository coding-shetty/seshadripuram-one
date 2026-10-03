import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";
import * as dotenv from "dotenv";
import { assertTestDatabaseSafe } from "./guard";

if (process.env.NODE_ENV !== "test") {
  dotenv.config();
}

function resolveInitialUrl(): string {
  const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
  if (process.env.NODE_ENV === "test") {
    assertTestDatabaseSafe(url);
  }
  return url;
}

let activeUrl = resolveInitialUrl();
let authToken = process.env.TURSO_AUTH_TOKEN;
let client: Client = createClient(authToken ? { url: activeUrl, authToken } : { url: activeUrl });
let currentDb = drizzle(client, { schema });

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(currentDb as any, prop, receiver);
  },
});

export function setTestDatabaseUrl(newUrl: string): void {
  assertTestDatabaseSafe(newUrl);
  try {
    client.close();
  } catch {
    // ignore
  }
  activeUrl = newUrl;
  authToken = undefined;
  client = createClient({ url: newUrl });
  currentDb = drizzle(client, { schema });
}

export function closeDatabase(): void {
  client.close();
}

