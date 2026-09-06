import "server-only";
import type { Filter, ObjectId } from "mongodb";
import type { Context } from "./context";

// Fair bounded scans: retain a cursor between ticks; wrap only at the end.
export async function scanBatch<T extends { _id: ObjectId }>(
  ctx: Context,
  collection: string,
  key: string,
  filter: Filter<T>,
  limit = 1000,
) {
  const cursors = ctx.db.collection<{ _id: string; after: ObjectId | null }>(
    "maintenanceCursors",
  );
  const current = await cursors.findOne({ _id: key });
  const query = {
    ...filter,
    ...(current?.after ? { _id: { $gt: current.after } } : {}),
  } as Filter<T>;
  const rows = await ctx.db
    .collection<T>(collection)
    .find(query)
    .sort({ _id: 1 })
    .limit(limit)
    .toArray();
  await cursors.updateOne(
    { _id: key },
    { $set: { after: rows.at(-1)?._id ?? null } },
    { upsert: true },
  );
  return rows;
}
