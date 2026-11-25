import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import Redis from "ioredis";

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

const projectRoot = process.cwd();
const envBase = parseEnvFile(path.join(projectRoot, ".env"));
const envLocal = parseEnvFile(path.join(projectRoot, ".env.local"));
const env = { ...envBase, ...envLocal, ...process.env };

const pick = (key, fallback = "") => String(env[key] || fallback).trim();

const mongoUri = env.MONGODB_URI;
if (!mongoUri) {
  console.error("ERROR: MONGODB_URI tidak ditemukan di .env / .env.local");
  process.exit(1);
}

const configValue = {
  owners: {
    developerDiscordId: pick("OWNER_DISCORD_ID", "338418945620967434"),
    nismaraOwnerDiscordId: pick("NISMARA_OWNER_DISCORD_ID", "560419724249530369"),
  },
  discordChannels: {
    generalDriverChannelId: pick("DISCORD_GENERAL_DRIVER_ID_CHANNEL"),
    interviewChannelId: pick("DISCORD_INTERVIEW_CHANNEL_ID"),
    plusCategoryId: pick("DISCORD_PLUS_CATEGORY_ID"),
    ticketCategoryId: pick("DISCORD_TICKET_CATEGORY_ID"),
    registrationCategoryId: pick("DISCORD_REGISTRATION_CATEGORY_ID"),
    serviceFleetCategoryId: pick("DISCORD_SERVICE_FLEET_CATEGORY_ID"),
    fleetOrderCategoryId: pick("DISCORD_FLEET_ORDER_CATEGORY_ID"),
    communityGoalsCategoryId: pick("DISCORD_COMMUNITY_GOALS_CATEGORY_ID"),
  },
  discordRoles: {
    driverRoleId: pick("DISCORD_DRIVER_ROLE_ID", "1405532668472590437"),
    internRoleId: pick("DISCORD_INTERN_ROLE_ID", "1405533443651272804"),
    managerRoleId: pick("DISCORD_MANAGER_ROLE_ID", "1406574228794507354"),
    nismaraPlusRoleId: pick("DISCORD_NISMARAPLUS_ROLE_ID"),
    lottoRoleId: pick("DISCORD_LOTTO_ROLE_ID"),
    staffHrRoleId: pick("DISCORD_STAFF_HR_ROLE_ID"),
    staffOperationalRoleId: pick("DISCORD_STAFF_OPERATIONAL_ROLE_ID"),
    staffGeneralManagerRoleId: pick("DISCORD_STAFF_GENERAL_MANAGER_ROLE_ID"),
    staffDeputyRoleId: pick("DISCORD_STAFF_DEPUTY_ROLE_ID"),
    staffDirectorRoleId: pick("DISCORD_STAFF_DIRECTOR_ROLE_ID"),
  },
  features: {
    seasonTheme: pick("NEXT_PUBLIC_HALLOWEEN_THEME") === "true" ? "halloween" : "none",
    halloweenTheme: pick("NEXT_PUBLIC_HALLOWEEN_THEME") === "true",
  },
};

async function main() {
  const client = new MongoClient(mongoUri);
  await client.connect();
  try {
    const db = client.db();
    const now = new Date();
    const res = await db.collection("systemsettings").updateOne(
      { key: "web_config" },
      {
        $set: {
          key: "web_config",
          value: configValue,
          updatedAt: now,
          updatedBy: "seed_web_config.mjs",
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    const flatFields = [
      ...Object.entries(configValue.owners),
      ...Object.entries(configValue.discordChannels),
      ...Object.entries(configValue.discordRoles),
    ];
    const filledCount = flatFields.filter(([, v]) => Boolean(v)).length;
    const missingKeys = flatFields.filter(([, v]) => !v).map(([k]) => k);

    console.log(
      JSON.stringify(
        {
          ok: true,
          collection: "systemsettings",
          key: "web_config",
          upserted: Boolean(res.upsertedId),
          modified: res.modifiedCount,
          matched: res.matchedCount,
          stringFieldsFilled: `${filledCount}/${flatFields.length}`,
          missingOptionalFields: missingKeys,
          halloweenTheme: configValue.features.halloweenTheme,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }

  if (env.REDIS_URL) {
    const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
    try {
      await redis.del("config:web:v1");
      console.log("Redis cache invalidated: config:web:v1");
    } catch (err) {
      console.warn("Redis invalidation skipped:", err?.message || err);
    } finally {
      redis.disconnect();
    }
  }
}

main().catch((err) => {
  console.error("Seed failed:", err?.message || err);
  process.exit(1);
});
