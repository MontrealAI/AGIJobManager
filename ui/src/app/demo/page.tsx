import { scenarios } from '@/demo/fixtures/scenarios';
import Link from 'next/link';

export default function DemoPage() {
  return (
    <div className='container py-8'>
      <h1 className='font-serif text-3xl'>Demo scenarios</h1>
      <table className='mt-4 w-full text-sm'>
        <thead><tr><th>Scenario</th><th>Notes</th><th>Launch</th></tr></thead>
        <tbody>
          {scenarios.map((scenario) => <tr key={scenario.key} className='border-t'><td>{scenario.title}</td><td>{scenario.notes}</td><td><Link className='underline' href={`/?scenario=${scenario.key}`}>Open</Link></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
