import { ObjectId, type Db } from "mongodb";

type Row = Record<string, unknown>;
const copy = <T>(value: T): T => {
  if (value instanceof ObjectId) return new ObjectId(value.toHexString()) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (Array.isArray(value)) return value.map(copy) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, copy(v)]),
    ) as T;
  return value;
};
const field = (row: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Row)[key] : undefined,
      row,
    );
const equal = (a: unknown, b: unknown): boolean =>
  a instanceof ObjectId || b instanceof ObjectId
    ? String(a) === String(b)
    : a instanceof Date || b instanceof Date
      ? Number(a) === Number(b)
      : a === b;
function matches(row: Row, filter: Row): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or")
      return (expected as Row[]).some((clause) => matches(row, clause));
    if (key === "$and")
      return (expected as Row[]).every((clause) => matches(row, clause));
    const actual = field(row, key);
    const one = (value: unknown) =>
      Array.isArray(actual)
        ? actual.some((item) => equal(item, value))
        : equal(actual, value);
    if (
      expected &&
      typeof expected === "object" &&
      !(expected instanceof ObjectId) &&
      !(expected instanceof Date)
    ) {
      return Object.entries(expected).every(([operator, value]) => {
        if (operator === "$in") return (value as unknown[]).some(one);
        if (operator === "$ne") return !one(value);
        if (operator === "$exists") return (actual !== undefined) === value;
        if (operator === "$lt") return Number(actual) < Number(value);
        if (operator === "$lte") return Number(actual) <= Number(value);
        if (operator === "$gt") return Number(actual) > Number(value);
        return false;
      });
    }
    return expected === null ? actual == null : one(expected);
  });
}
function assign(row: Row, path: string, value: unknown, remove = false) {
  const keys = path.split(".");
  let target = row;
  for (const key of keys.slice(0, -1)) {
    target[key] ??= {};
    target = target[key] as Row;
  }
  if (remove) delete target[keys.at(-1)!];
  else target[keys.at(-1)!] = copy(value);
}

// Transactional test double, not an alternative application database. Hosted
// Mongo unique-index/write-conflict behaviour still requires the manual gate.
export class MemoryDb {
  rows: Record<string, Row[]> = {};
  private tail = Promise.resolve();
  data(name: string): Row[] {
    return (this.rows[name] ??= []);
  }
  seed(name: string, rows: Row[]) {
    this.rows[name] = copy(rows);
  }
  async transaction<T>(
    operation: (db: Db, session: unknown) => Promise<T>,
  ): Promise<T> {
    const before = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await before;
    const snapshot = copy(this.rows);
    try {
      return await operation(this.db, {});
    } catch (error) {
      this.rows = snapshot;
      throw error;
    } finally {
      release();
    }
  }
  get db(): Db {
    return this as unknown as Db;
  }
  collection(name: string) {
    const change = async (filter: Row, update: Row, options: Row = {}) => {
      let row = this.data(name).find((item) => matches(item, filter));
      const existed = Boolean(row);
      if (!row && options.upsert) {
        row = {
          _id: new ObjectId(),
          ...Object.fromEntries(
            Object.entries(filter).filter(([k]) => !k.startsWith("$")),
          ),
        };
        this.data(name).push(row);
      }
      if (!row) return { value: null, modifiedCount: 0 };
      for (const [kind, values] of Object.entries(update))
        for (const [path, value] of Object.entries(values as Row)) {
          if (kind === "$set" || (kind === "$setOnInsert" && !existed))
            assign(row, path, value);
          if (kind === "$inc")
            assign(row, path, Number(field(row, path) ?? 0) + Number(value));
          if (kind === "$unset") assign(row, path, null, true);
        }
      return { value: copy(row), modifiedCount: 1 };
    };
    return {
      findOne: async (filter: Row) =>
        copy(this.data(name).find((row) => matches(row, filter)) ?? null),
      find: (filter: Row = {}) => {
        let result = this.data(name).filter((row) => matches(row, filter));
        const cursor = {
          sort: (keys: Row) => {
            result.sort((a, b) => {
              for (const [key, direction] of Object.entries(keys)) {
                const av = field(a, key),
                  bv = field(b, key);
                const comparison =
                  av instanceof Date
                    ? Number(av) - Number(bv)
                    : String(av).localeCompare(String(bv));
                if (comparison) return comparison * Number(direction);
              }
              return 0;
            });
            return cursor;
          },
          limit: (limit: number) => {
            result = result.slice(0, limit);
            return cursor;
          },
          toArray: async () => copy(result),
        };
        return cursor;
      },
      updateOne: async (filter: Row, update: Row, options?: Row) =>
        change(filter, update, options),
      findOneAndUpdate: async (filter: Row, update: Row, options?: Row) =>
        (await change(filter, update, options)).value,
      updateMany: async (filter: Row, update: Row) => {
        let count = 0;
        for (const row of [...this.data(name)])
          if (matches(row, filter)) {
            await change({ _id: row._id }, update);
            count++;
          }
        return { modifiedCount: count };
      },
      insertOne: async (row: Row) => {
        this.data(name).push(copy(row));
        return { insertedId: row._id };
      },
      replaceOne: async (filter: Row, row: Row) => {
        const index = this.data(name).findIndex((item) =>
          matches(item, filter),
        );
        if (index < 0) return { modifiedCount: 0 };
        this.data(name)[index] = copy(row);
        return { modifiedCount: 1 };
      },
      countDocuments: async (filter: Row) =>
        this.data(name).filter((row) => matches(row, filter)).length,
    };
  }
}
