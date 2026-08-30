import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI in .env.local");
  process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db();

    console.log("Connected to MongoDB. Migrating kb_categories accessLevel...");

    const categories = await db.collection("kb_categories").find({}).toArray();
    let updatedCount = 0;

    for (const cat of categories) {
      if (!cat.accessLevel) {
        await db.collection("kb_categories").updateOne(
          { _id: cat._id },
          { $set: { accessLevel: "public" } }
        );
        console.log(`-> Set accessLevel: "public" for category: ${cat.name} (${cat.slug})`);
        updatedCount++;
      }
    }

    console.log(`\n✅ Migration completed! Updated ${updatedCount} categories to default "public" accessLevel.`);
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await client.close();
  }
}

run();
