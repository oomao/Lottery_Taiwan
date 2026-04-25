import type { GameConfig } from '@/lib/types';

interface BallProps {
  number: number;
  color?: GameConfig['ballColor'];
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-xl',
};

const colorClasses = {
  red: 'bg-gradient-to-br from-red-500 to-red-700 text-white',
  blue: 'bg-gradient-to-br from-blue-500 to-blue-700 text-white',
  yellow: 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-gray-900',
};

export default function Ball({ number, color = 'red', size = 'md' }: BallProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold shadow-md ${sizeClasses[size]} ${colorClasses[color]}`}
    >
      {number.toString().padStart(2, '0')}
    </span>
  );
}
