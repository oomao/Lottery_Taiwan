import path from 'node:path';
import { fetch539, readExisting, mergeDraws, writeDraws } from './common';

const OUTPUT = path.join(process.cwd(), 'public/data/539/raw.json');
const MONTHS_BACK = Number(process.env.MONTHS_BACK ?? 12);

async function main() {
  console.log(`[fetch-539] 抓取近 ${MONTHS_BACK} 個月`);
  const fresh = await fetch539(MONTHS_BACK);
  const existing = await readExisting(OUTPUT);
  const merged = mergeDraws(existing, fresh);
  await writeDraws(OUTPUT, merged);
  console.log(`[fetch-539] 完成,共 ${merged.length} 期`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
