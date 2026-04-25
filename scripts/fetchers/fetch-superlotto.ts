import path from 'node:path';
import { fetchSuperLotto, readExisting, mergeDraws, writeDraws } from './common';

const OUTPUT = path.join(process.cwd(), 'public/data/superlotto/raw.json');
const MONTHS_BACK = Number(process.env.MONTHS_BACK ?? 24);

async function main() {
  console.log(`[fetch-superlotto] 抓取近 ${MONTHS_BACK} 個月`);
  const fresh = await fetchSuperLotto(MONTHS_BACK);
  const existing = await readExisting(OUTPUT);
  const merged = mergeDraws(existing, fresh);
  await writeDraws(OUTPUT, merged);
  console.log(`[fetch-superlotto] 完成,共 ${merged.length} 期`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
