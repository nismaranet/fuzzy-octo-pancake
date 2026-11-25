import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

// Load .env and .env.local without external dependencies
function loadEnvFiles(rootDir) {
  const env = { ...process.env };
  for (const filename of [".env", ".env.local"]) {
    const filePath = path.join(rootDir, filename);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) {
        env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return env;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchTruckyUser(truckyId, apiKey, attempt = 1) {
  const res = await fetch(`https://e.truckyapp.com/api/v2/user/${truckyId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-access-token": apiKey,
      "User-Agent": "NismaraTransport/1.0 (https://transport.nismara.web.id)",
      Referer: "https://nismara.web.id",
      Origin: "https://nismara.web.id",
    },
  });

  if (res.status === 429 && attempt <= 3) {
    const retryAfter = Number(res.headers.get("retry-after") || 5) * 1000;
    console.warn(`[429] Rate limited on truckyId=${truckyId}, waiting ${retryAfter}ms...`);
    await sleep(retryAfter);
    return fetchTruckyUser(truckyId, apiKey, attempt + 1);
  }

  if (!res.ok) {
    return { ok: false, status: res.status };
  }

  const data = await res.json();
  return { ok: true, data };
}

async function main() {
  const rootDir = process.cwd();
  const env = loadEnvFiles(rootDir);

  if (!env.MONGODB_URI || !env.TRUCKY_API_KEY) {
    console.error("Missing MONGODB_URI or TRUCKY_API_KEY in .env / .env.local");
    process.exit(1);
  }

  const client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  const db = client.db();

  try {
    const users = await db
      .collection("users")
      .find(
        { truckyId: { $exists: true, $ne: null } },
        {
          projection: {
            _id: 1,
            name: 1,
            discordId: 1,
            truckyId: 1,
            steamId: 1,
            steamUsername: 1,
            truckyRole: 1,
            truckyRoleColor: 1,
          },
        }
      )
      .toArray();

    console.log(`Found ${users.length} users with truckyId. Starting Trucky API v2 backfill...`);

    let newlyFilled = 0;
    let precisionCorrected = 0;
    let roleUpdated = 0;
    let unchanged = 0;
    let noSteamProfile = 0;
    let apiErrors = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const truckyId = Number(user.truckyId);
      if (!Number.isFinite(truckyId) || truckyId <= 0) {
        apiErrors++;
        continue;
      }

      const result = await fetchTruckyUser(truckyId, env.TRUCKY_API_KEY);
      if (!result.ok) {
        console.warn(`[SKIP] truckyId=${truckyId} (${user.name || user.discordId}) -> HTTP ${result.status}`);
        apiErrors++;
        await sleep(250);
        continue;
      }

      const profile = result.data;
      const newSteamId = profile?.steam_profile?.steam_id
        ? String(profile.steam_profile.steam_id)
        : null;
      const newSteamUsername = profile?.steam_profile?.steam_username
        ? String(profile.steam_profile.steam_username)
        : null;

      const updateFields = {};

      if (newSteamId) {
        if (!user.steamId) {
          updateFields.steamId = newSteamId;
          newlyFilled++;
        } else if (String(user.steamId) !== newSteamId) {
          console.log(
            `[FIX PRECISION] ${user.name || user.discordId} (truckyId=${truckyId}): ${user.steamId} -> ${newSteamId}`
          );
          updateFields.steamId = newSteamId;
          precisionCorrected++;
        }
      } else {
        noSteamProfile++;
      }

      if (newSteamUsername && user.steamUsername !== newSteamUsername) {
        updateFields.steamUsername = newSteamUsername;
      }

      if (profile?.role?.name && user.truckyRole !== profile.role.name) {
        updateFields.truckyRole = profile.role.name;
        if (profile.role.color) {
          updateFields.truckyRoleColor = profile.role.color;
        }
        roleUpdated++;
      }

      if (Object.keys(updateFields).length > 0) {
        updateFields.updatedAt = new Date();
        await db.collection("users").updateOne(
          { _id: user._id },
          { $set: updateFields }
        );
      } else if (newSteamId) {
        unchanged++;
      }

      // Gentle delay to avoid Trucky API rate limits
      await sleep(220);
    }

    console.log("\n=== Backfill Summary ===");
    console.log(`Total processed     : ${users.length}`);
    console.log(`Newly filled steamId: ${newlyFilled}`);
    console.log(`Corrected steamId   : ${precisionCorrected}`);
    console.log(`Updated truckyRole  : ${roleUpdated}`);
    console.log(`Unchanged           : ${unchanged}`);
    console.log(`No steam_profile    : ${noSteamProfile}`);
    console.log(`API/invalid errors  : ${apiErrors}`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
