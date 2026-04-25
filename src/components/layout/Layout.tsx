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
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-2 sm:gap-3">
          {/* 品牌:手機版只顯示 emoji + 短名,桌機版完整 */}
          <NavLink
            to="/"
            className="text-base sm:text-xl font-bold text-brand whitespace-nowrap shrink-0"
            aria-label="台灣運彩資訊首頁"
          >
            <span className="sm:hidden">🎲 運彩</span>
            <span className="hidden sm:inline">🎲 台灣運彩資訊</span>
          </NavLink>

          {/* 導覽:不換行、超寬可橫向捲動 */}
          <nav className="flex gap-1 ml-auto overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition whitespace-nowrap shrink-0 ${
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

          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-700 py-4 px-3 text-center text-xs text-gray-500">
        資料來源:台灣彩券 ‧ 本站僅提供統計與查詢,中獎以官方公告為準
      </footer>
    </div>
  );
}
