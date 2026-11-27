// In-memory Store for tests. Not used by the app.
import type { Store } from "../store";

export class MemoryStore implements Store {
  private data = new Map<string, Map<string, unknown>>();
  async get<T>(c: string, id: string) {
    return (this.data.get(c)?.get(id) as T | undefined) ?? null;
  }
  async put<T>(c: string, id: string, doc: T) {
    if (!this.data.has(c)) this.data.set(c, new Map());
    this.data.get(c)!.set(id, structuredClone(doc));
  }
  async delete(c: string, id: string) {
    this.data.get(c)?.delete(id);
  }
  async list<T>(c: string) {
    return [...(this.data.get(c)?.values() ?? [])].map((d) => structuredClone(d) as T);
  }
}
