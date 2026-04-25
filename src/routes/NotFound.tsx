import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card text-center py-16">
      <div className="text-5xl mb-4">🤔</div>
      <h2 className="text-2xl font-bold mb-2">找不到頁面</h2>
      <Link to="/" className="text-brand hover:underline">
        回到首頁
      </Link>
    </div>
  );
}
