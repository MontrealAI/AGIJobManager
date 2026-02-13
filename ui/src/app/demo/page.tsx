import Link from 'next/link';
import { demoScenarios } from '@/demo/fixtures/scenarios';

export default function DemoPage() {
  return <div className='container-shell py-8 space-y-4'>
    <h1 className='font-serif text-4xl'>Demo scenario gallery</h1>
    <table className='w-full text-sm card-shell'><thead><tr><th>Name</th><th>Paused</th><th>Settlement paused</th><th>Degraded</th><th>Open</th></tr></thead>
      <tbody>{demoScenarios.map((s)=><tr key={s.key} className='border-t border-border'><td>{s.title}</td><td>{String(s.paused)}</td><td>{String(s.settlementPaused)}</td><td>{String(s.degradedRpc)}</td><td><Link className='underline' href={`/?scenario=${s.key}`}>Launch</Link></td></tr>)}</tbody>
    </table>
  </div>;
}
