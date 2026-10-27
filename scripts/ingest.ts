/** Run ingestion locally against DATABASE_URL: `npm run ingest`. */
import { db } from "../src/lib/db";
import { ingestAll } from "../src/lib/ingestion/run";

async function main() {
  const results = await ingestAll();
  for (const r of results) {
    console.log(
      `${(r.company ?? r.companyId).padEnd(22)} fetched=${r.fetched} +${r.created} ~${r.updated} -${r.deactivated}${r.error ? ` ERROR ${r.error}` : ""}`,
    );
  }
  await db.$disconnect();
}

void main();
