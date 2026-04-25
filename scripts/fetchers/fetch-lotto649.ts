import path from 'node:path';
import { fetchLotto649, readExisting, mergeDraws, writeDraws } from './common';

const OUTPUT = path.join(process.cwd(), 'public/data/lotto649/raw.json');
const MONTHS_BACK = Math.max(1, Math.min(36, Number(process.env.MONTHS_BACK ?? 24)));

async function main() {
  console.log(`[fetch-lotto649] 抓取近 ${MONTHS_BACK} 個月`);
  const fresh = await fetchLotto649(MONTHS_BACK);
  const existing = await readExisting(OUTPUT);
  const merged = mergeDraws(existing, fresh);
  await writeDraws(OUTPUT, merged);
  console.log(`[fetch-lotto649] 完成,共 ${merged.length} 期`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
