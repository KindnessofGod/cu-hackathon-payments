import { Pool } from "pg";
import type { Store } from "./index";

/** One table of JSON documents. Schema is in supabase/schema.sql. */
export class PostgresStore implements Store {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 3, ssl: { rejectUnauthorized: false } });
  }

  async get<T>(collection: string, id: string): Promise<T | null> {
    const r = await this.pool.query("select doc from op_docs where collection = $1 and id = $2", [collection, id]);
    return r.rows.length ? (r.rows[0].doc as T) : null;
  }

  async put<T>(collection: string, id: string, doc: T): Promise<void> {
    await this.pool.query(
      `insert into op_docs (collection, id, doc, updated_at) values ($1, $2, $3, now())
       on conflict (collection, id) do update set doc = excluded.doc, updated_at = now()`,
      [collection, id, JSON.stringify(doc)],
    );
  }

  async delete(collection: string, id: string): Promise<void> {
    await this.pool.query("delete from op_docs where collection = $1 and id = $2", [collection, id]);
  }

  async list<T>(collection: string): Promise<T[]> {
    const r = await this.pool.query("select doc from op_docs where collection = $1 order by updated_at desc limit 500", [collection]);
    return r.rows.map((row) => row.doc as T);
  }
}
