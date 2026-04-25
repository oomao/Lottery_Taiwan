import { useEffect, useState } from 'react';
import { getStoredTheme, setStoredTheme, type Theme } from '@/lib/theme';

const OPTIONS: { value: Theme; icon: string; label: string }[] = [
  { value: 'light', icon: '☀️', label: '亮色' },
  { value: 'dark', icon: '🌙', label: '暗色' },
  { value: 'system', icon: '💻', label: '系統' },
];

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const handleChange = (t: Theme) => {
    setTheme(t);
    setStoredTheme(t);
  };

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => handleChange(o.value)}
          title={o.label}
          aria-label={`切換成${o.label}主題`}
          className={`w-7 h-7 text-sm rounded transition ${
            theme === o.value
              ? 'bg-white dark:bg-gray-800 shadow-sm'
              : 'hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
