import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { scenarios } from '@/demo/fixtures/scenarios';

export default function DemoPage() {
  return (
    <div className="container py-8">
      <Card>
        <h1 className="font-serif text-3xl">Demo scenarios</h1>
        <table className="w-full text-sm mt-3"><thead><tr><th>Scenario</th><th>Description</th><th>Paused</th><th>Settlement</th></tr></thead><tbody>{scenarios.map((s) => <tr key={s.id} className="border-t border-border"><td><Link className="underline" href={`/?scenario=${s.id}`}>{s.id}</Link></td><td>{s.title}</td><td>{String(s.paused)}</td><td>{String(s.settlementPaused)}</td></tr>)}</tbody></table>
      </Card>
    </div>
  );
}
