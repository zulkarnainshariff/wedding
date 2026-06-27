import "dotenv/config";
import { resetApplicationSequences } from "../lib/database-sequences";

async function main() {
  const count = await resetApplicationSequences();
  console.log(`Reset ${count} table sequences.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
