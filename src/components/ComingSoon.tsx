interface Props {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: Props) {
  return (
    <div className="card text-center py-16">
      <div className="text-5xl mb-4">🚧</div>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-gray-500">{description ?? '此功能開發中,敬請期待'}</p>
    </div>
  );
}
