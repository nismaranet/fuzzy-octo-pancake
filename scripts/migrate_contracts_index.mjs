import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

function parseEnvFile(filePath) {
  const res = {};
  if (!fs.existsSync(filePath)) return res;
  for (const raw of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    res[line.slice(0, eq).trim()] = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return res;
}

const env = {
  ...parseEnvFile(path.join(process.cwd(), ".env")),
  ...parseEnvFile(path.join(process.cwd(), ".env.local")),
  ...process.env,
};

if (!env.MONGODB_URI) {
  console.error("ERROR: MONGODB_URI tidak ditemukan.");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  try {
    const db = client.db();
    const col = db.collection("contracts");

    // 1. Backfill semua kontrak lama agar memiliki contractCategory: "truck"
    const backfillRes = await col.updateMany(
      { contractCategory: { $exists: false } },
      {
        $set: {
          contractCategory: "truck",
          targetCities: [],
          coachMarketFilter: "all",
          minPassengers: 0,
          totalPassengers: 0,
        },
      }
    );

    // 2. Cek index lama guildId_1_gameId_1 dan ganti dengan guildId_1_gameId_1_contractCategory_1
    const existingIndexes = await col.indexes();
    const oldIdx = existingIndexes.find(
      (idx) =>
        idx.name === "guildId_1_gameId_1" ||
        (idx.key?.guildId === 1 &&
          idx.key?.gameId === 1 &&
          !idx.key?.contractCategory &&
          idx.unique)
    );

    let droppedOld = null;
    if (oldIdx) {
      await col.dropIndex(oldIdx.name);
      droppedOld = oldIdx.name;
    }

    await col.createIndex(
      { guildId: 1, gameId: 1, contractCategory: 1 },
      { unique: true, partialFilterExpression: { isActive: true } }
    );

    const afterIndexes = await col.indexes();
    console.log(
      JSON.stringify(
        {
          ok: true,
          backfilledTruckContracts: backfillRes.modifiedCount,
          droppedOldIndex: droppedOld,
          activeIndexes: afterIndexes.map((i) => ({
            name: i.name,
            key: i.key,
            unique: Boolean(i.unique),
            partialFilterExpression: i.partialFilterExpression || null,
          })),
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err?.message || err);
  process.exit(1);
});
