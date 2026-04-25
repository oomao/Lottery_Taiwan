// 一鍵更新:三個彩種抓資料 + 算統計
import { execSync } from 'node:child_process';

function run(cmd: string) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

const games = ['539', 'lotto649', 'superlotto'];

for (const g of games) {
  run(`npx tsx scripts/fetchers/fetch-${g}.ts`);
  run(`npx tsx scripts/stats/compute-all.ts ${g}`);
}

console.log('\n✅ 全部更新完成');
