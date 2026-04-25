import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { GAME_LIST } from '@/lib/games';
import ThemeToggle from './ThemeToggle';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navItems = [
    { to: '/', label: '首頁' },
    ...GAME_LIST.map((g) => ({ to: `/${g.id}`, label: g.shortName })),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-bold text-brand">
            🎲 台灣運彩資訊
          </NavLink>
          <div className="flex items-center gap-3">
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand text-white'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-gray-200 dark:border-gray-700 py-4 text-center text-xs text-gray-500">
        資料來源:台灣彩券 ‧ 本站僅提供統計與查詢,中獎以官方公告為準
      </footer>
    </div>
  );
}
