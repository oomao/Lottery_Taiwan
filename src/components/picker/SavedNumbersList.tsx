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
    const nums = manualInput
      .split(/[\s,，、]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n));
    const [min, max] = game.numberRange;
    const valid = nums.filter((n) => n >= min && n <= max);
    const unique = Array.from(new Set(valid));
    if (unique.length !== game.pickCount) {
      alert(`需要 ${game.pickCount} 個 ${min}–${max} 範圍內的不重複號碼`);
      return;
    }
    const next = [...items, { numbers: unique.sort((a, b) => a - b), savedAt: new Date().toISOString() }];
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
