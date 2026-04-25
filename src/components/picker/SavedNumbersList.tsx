import { useEffect, useState } from 'react';
import type { GameConfig } from '@/lib/types';
import Ball from '@/components/ui/Ball';

interface SavedItem {
  numbers: number[];
  savedAt: string;
  note?: string;
}

interface Props {
  game: GameConfig;
}

const storageKey = (gameId: string) => `lottery_saved_${gameId}`;

function loadSaved(gameId: string): SavedItem[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(gameId)) ?? '[]');
  } catch {
    return [];
  }
}

function writeSaved(gameId: string, list: SavedItem[]) {
  localStorage.setItem(storageKey(gameId), JSON.stringify(list));
  window.dispatchEvent(new Event('lottery_saved_updated'));
}

export default function SavedNumbersList({ game }: Props) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [manualInput, setManualInput] = useState('');

  useEffect(() => {
    const refresh = () => setItems(loadSaved(game.id));
    refresh();
    window.addEventListener('lottery_saved_updated', refresh);
    return () => window.removeEventListener('lottery_saved_updated', refresh);
  }, [game.id]);

  const addManual = () => {
    const [min, max] = game.numberRange;
    // 支援多種分隔符:空格、半形/全形逗號、頓號、半形/全形分號
    const tokens = manualInput.trim().split(/[\s,\uFF0C\u3001;\uFF1B]+/).filter(Boolean);
    if (tokens.length === 0) {
      alert('請輸入號碼');
      return;
    }
    const parsed = tokens.map((s) => Number(s));
    if (parsed.some((n) => !Number.isFinite(n) || !Number.isInteger(n))) {
      alert('只能輸入整數');
      return;
    }
    const outOfRange = parsed.filter((n) => n < min || n > max);
    if (outOfRange.length > 0) {
      alert(`號碼必須在 ${min}–${max} 範圍內,以下無效:${outOfRange.join(', ')}`);
      return;
    }
    const unique = Array.from(new Set(parsed));
    if (unique.length !== parsed.length) {
      alert('號碼不能重複');
      return;
    }
    if (unique.length !== game.pickCount) {
      alert(`需要剛好 ${game.pickCount} 個號碼,你輸入了 ${unique.length} 個`);
      return;
    }
    const sortedNums = unique.sort((a, b) => a - b);
    // 防呆:檢查是否已存在相同組合
    const exists = items.some((it) => it.numbers.join(',') === sortedNums.join(','));
    if (exists) {
      alert('此組號碼已經收藏過了');
      return;
    }
    const next = [...items, { numbers: sortedNums, savedAt: new Date().toISOString() }];
    writeSaved(game.id, next);
    setItems(next);
    setManualInput('');
  };

  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    writeSaved(game.id, next);
    setItems(next);
  };

  const clearAll = () => {
    if (!confirm('確定清空所有守號?')) return;
    writeSaved(game.id, []);
    setItems([]);
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">⭐ 我的守號</h3>
        {items.length > 0 && (
          <button onClick={clearAll} className="text-xs text-red-600 hover:underline">
            全部清除
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder={`輸入 ${game.pickCount} 個號碼,用空格或逗號分隔`}
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700"
          onKeyDown={(e) => e.key === 'Enter' && addManual()}
        />
        <button
          onClick={addManual}
          className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white rounded text-sm"
        >
          新增
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-6">
          尚無收藏。從上方選號工具產生後可收藏,或在此手動輸入。
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-center gap-3 p-2 border border-gray-200 dark:border-gray-700 rounded"
            >
              <div className="flex gap-1.5 flex-wrap">
                {item.numbers.map((n) => (
                  <Ball key={n} number={n} color={game.ballColor} size="sm" />
                ))}
              </div>
              <span className="text-xs text-gray-500 ml-auto">
                {new Date(item.savedAt).toLocaleDateString('zh-TW')}
              </span>
              <button
                onClick={() => remove(i)}
                className="text-xs text-red-500 hover:underline"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
