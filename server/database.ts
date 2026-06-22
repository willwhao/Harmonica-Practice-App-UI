import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import initSqlJs, { type BindParams, type Database } from 'sql.js';

const require = createRequire(import.meta.url);

export class AppDatabase {
  private inTransaction = false;

  constructor(private readonly database: Database, private readonly filename?: string) {}

  run(sql: string, params: BindParams = null) {
    this.database.run(sql, params);
    if (!this.inTransaction) this.persist();
  }

  get<T extends Record<string, unknown>>(sql: string, params: BindParams = null): T | undefined {
    const statement = this.database.prepare(sql, params);
    try {
      return statement.step() ? statement.getAsObject() as T : undefined;
    } finally {
      statement.free();
    }
  }

  all<T extends Record<string, unknown>>(sql: string, params: BindParams = null): T[] {
    const statement = this.database.prepare(sql, params);
    const rows: T[] = [];
    try {
      while (statement.step()) rows.push(statement.getAsObject() as T);
      return rows;
    } finally {
      statement.free();
    }
  }

  transaction<T>(operation: () => T): T {
    this.database.run('BEGIN IMMEDIATE');
    this.inTransaction = true;
    try {
      const result = operation();
      this.database.run('COMMIT');
      this.inTransaction = false;
      this.persist();
      return result;
    } catch (error) {
      this.database.run('ROLLBACK');
      this.inTransaction = false;
      throw error;
    }
  }

  close() {
    this.persist();
    this.database.close();
  }

  private persist() {
    if (this.filename) writeFileSync(this.filename, this.database.export());
  }
}

export async function createDatabase(filename?: string) {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
  const data = filename && existsSync(filename) ? readFileSync(filename) : undefined;
  const database = new AppDatabase(new SQL.Database(data), filename);
  database.run('PRAGMA foreign_keys = ON');
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      preferences_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS refresh_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revoked_at TEXT,
      replaced_by TEXT
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT
    );
    CREATE TABLE IF NOT EXISTS practice_history (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      song_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      accuracy INTEGER NOT NULL,
      practiced_at TEXT NOT NULL,
      duration_seconds INTEGER,
      weak_measures_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_history_user_updated ON practice_history(user_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_sessions(token_hash);
  `);
  return database;
}
