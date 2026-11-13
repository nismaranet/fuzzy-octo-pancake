import { MongoClient } from "mongodb";

const options = {};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

function getClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }

  return global._mongoClientPromise;
}

// Lazy Promise wrapper agar import saat `next build` (CI/Docker) tidak melempar error jika MONGODB_URI baru disuntikkan saat runtime
const clientPromise: Promise<MongoClient> = new Proxy(
  Promise.resolve() as unknown as Promise<MongoClient>,
  {
    get(_target, prop) {
      if (prop === "then" || prop === "catch" || prop === "finally") {
        const promise = getClientPromise();
        const value = (promise as unknown as Record<PropertyKey, unknown>)[prop];
        return typeof value === "function" ? value.bind(promise) : value;
      }
      return undefined;
    },
  }
);

export default clientPromise;
