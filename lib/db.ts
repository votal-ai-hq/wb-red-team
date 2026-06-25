/**
 * Postgres connection pool and migration runner.
 * Only active when DATABASE_URL is set; otherwise all functions are no-ops.
 */

import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

let pool: pg.Pool | null = null;

export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL && !process.env.__DB_DISABLED;
}

export function getPool(): pg.Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    const connStr = process.env.DATABASE_URL!;
    const needsSsl =
      connStr.includes("supabase.co") ||
      connStr.includes("neon.tech") ||
      connStr.includes("sslmode=require") ||
      process.env.PG_SSL === "true";

    pool = new pg.Pool({
      connectionString: connStr,
      max: parseInt(process.env.PG_POOL_MAX || "10", 10),
      // Retire idle connections quickly so a managed pooler (Supabase/PgBouncer)
      // doesn't silently kill one we still believe is good and hand it back dead.
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || "10000", 10),
      // Give a momentarily-busy pooler room to return a connection rather than
      // erroring at 5s (queryWithRetry still covers the rest).
      connectionTimeoutMillis: parseInt(
        process.env.PG_CONNECT_TIMEOUT_MS || "10000",
        10,
      ),
      // TCP keepalive surfaces half-open sockets (peer vanished with no FIN/RST)
      // as errors instead of letting a query hang on a dead connection forever.
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // Hard per-query ceilings. THIS is what stops the wedge that used to need a
      // manual restart: a query issued on a silently-dead connection would hang
      // indefinitely, holding its pool slot until every slot was stuck. With a
      // timeout the query errors out, the client is discarded, and queryWithRetry
      // opens a fresh one. (statement_timeout = server-side cancel; query_timeout
      // = client-side abort that also evicts the bad connection.)
      statement_timeout: parseInt(
        process.env.PG_STATEMENT_TIMEOUT_MS || "30000",
        10,
      ),
      query_timeout: parseInt(process.env.PG_QUERY_TIMEOUT_MS || "30000", 10),
      // Proactively recycle connections so none lingers long enough to go stale
      // on the pooler side — keeps a steady, self-refreshing set of live sockets.
      maxLifetimeSeconds: parseInt(
        process.env.PG_MAX_LIFETIME_SEC || "1800",
        10,
      ),
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });

    // CRITICAL: a managed Postgres (Railway/Neon/Supabase) terminating an idle
    // pooled connection makes pg emit an 'error' event on that client. With no
    // listener, Node treats it as an unhandled error and CRASHES THE PROCESS —
    // so a routine connection recycle would take the whole server down (and log
    // every user out on restart). Swallow it: the pool discards the dead client,
    // and the next query opens a fresh one (queryWithRetry covers in-flight use).
    pool.on("error", (err) => {
      console.warn(
        `  [db] idle pool client error (recovered): ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }
  return pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * True for errors that mean "the connection/server was momentarily unavailable",
 * NOT "your query was wrong". These are the failures a managed Postgres (Railway,
 * Neon, Supabase) throws when it reaps an idle connection, recycles, or briefly
 * runs out of slots — retrying on a fresh connection succeeds. We must never
 * treat these as application/auth errors (doing so logs valid users out).
 */
export function isTransientDbError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (typeof code === "string") {
    // Node socket errors + Postgres connection-class SQLSTATEs.
    if (
      [
        "ECONNRESET",
        "ETIMEDOUT",
        "EPIPE",
        "ENOTFOUND",
        "ECONNREFUSED",
        "57P01", // admin_shutdown
        "57P02", // crash_shutdown
        "57P03", // cannot_connect_now (e.g. DB still starting)
        "08000", // connection_exception
        "08003", // connection_does_not_exist
        "08006", // connection_failure
      ].includes(code)
    ) {
      return true;
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /Connection terminated|terminating connection|Client has encountered a connection error|server closed the connection|timeout exceeded when trying to connect|connection timeout/i.test(
    msg,
  );
}

/**
 * query() with a short retry on transient connection failures. Use this for
 * idempotent statements (SELECT, or UPSERT/INSERT … ON CONFLICT) on hot paths
 * such as auth, where a single dropped pooled connection must not surface as a
 * user-facing failure. Genuine SQL/constraint errors are re-thrown immediately.
 */
export async function queryWithRetry<
  T extends pg.QueryResultRow = pg.QueryResultRow,
>(text: string, params?: unknown[], attempts = 3): Promise<pg.QueryResult<T>> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await getPool().query<T>(text, params);
    } catch (err) {
      lastErr = err;
      if (!isTransientDbError(err) || i === attempts - 1) throw err;
      // Brief backoff lets the pool discard the dead connection before retry.
      await new Promise((r) => setTimeout(r, 100 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function runMigrations(): Promise<void> {
  if (!isDbConfigured()) return;

  const client = await getPool().connect();
  try {
    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version   INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Check which migrations have been applied
    const applied = await client.query<{ version: number }>(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    const appliedVersions = new Set(applied.rows.map((r) => r.version));

    // Discover all migration files (NNN-name.sql, sorted by number)
    const migrationsDir = join(
      import.meta.dirname ?? process.cwd(),
      "migrations",
    );
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql") && /^\d{3}-/.test(f))
      .sort();

    for (const file of files) {
      const version = parseInt(file.slice(0, 3), 10);
      if (appliedVersions.has(version)) continue;

      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [version],
        );
        await client.query("COMMIT");
        console.log(`  Migration ${file} applied successfully`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
