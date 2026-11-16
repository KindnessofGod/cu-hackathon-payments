// Small document store. Everything the two apps remember goes through this interface.
// Local runs use a JSON file; the deployed demo uses Postgres (set DATABASE_URL).
import { FileStore } from "./file";
import { PostgresStore } from "./postgres";

export interface Store {
  get<T>(collection: string, id: string): Promise<T | null>;
  put<T>(collection: string, id: string, doc: T): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  list<T>(collection: string): Promise<T[]>;
}

let store: Store | undefined;

export function getStore(): Store {
  if (!store) store = process.env.DATABASE_URL ? new PostgresStore(process.env.DATABASE_URL) : new FileStore();
  return store;
}
