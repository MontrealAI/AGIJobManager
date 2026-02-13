import Link from 'next/link';
import { demoScenarios } from '@/lib/demo/scenarios';

export default function DemoPage() {
  return <div className='container py-8'><h1 className='font-serif text-4xl mb-4'>Demo Scenarios</h1><table className='w-full text-sm'><thead><tr><th>ID</th><th>Title</th><th>Summary</th><th>Open</th></tr></thead><tbody>{demoScenarios.map((s) => <tr key={s.id} className='border-t border-border'><td>{s.id}</td><td>{s.title}</td><td>{s.summary}</td><td><Link className='underline' href={`/?scenario=${s.id}`}>Launch</Link></td></tr>)}</tbody></table></div>;
}
