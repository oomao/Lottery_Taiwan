export type Theme = 'light' | 'dark' | 'system';

const KEY = 'lottery_theme';

export function getStoredTheme(): Theme {
  return (localStorage.getItem(KEY) as Theme) ?? 'system';
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export function initTheme() {
  applyTheme(getStoredTheme());
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getStoredTheme() === 'system') applyTheme('system');
    });
}
