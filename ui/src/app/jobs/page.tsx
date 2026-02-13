'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { deriveStatus } from '@/lib/jobStatus';
import { fmtAddr, fmtToken } from '@/lib/format';
import { useJobs } from '@/lib/web3/queries';

function csv(rows: string[][]) { return rows.map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(',')).join('\n'); }

export default function Jobs() {
  const [scenario, setScenario] = useState<string | undefined>(undefined);
  useEffect(() => { setScenario(new URLSearchParams(window.location.search).get('scenario') || undefined); }, []);
  const { data } = useJobs(scenario);
  const rows = (data ?? []).map((j: any) => {
    const s = deriveStatus({ assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] }, { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] });
    return [String(j.id), s.status, fmtToken(j.core[2]), fmtAddr(j.core[0]), fmtAddr(j.core[1])];
  });

  return <div className="container py-8 space-y-3"><Card>
    <div className='flex justify-between items-center pb-2'><h1 className='font-serif text-2xl'>Jobs Ledger</h1><button data-testid='csv-export' onClick={() => navigator.clipboard.writeText(csv([['id', 'status', 'payout', 'employer', 'agent'], ...rows]))}>Export CSV</button></div>
    <table className="w-full text-sm"><thead><tr><th>ID</th><th>Status</th><th>Payout</th><th>Employer</th><th>Agent</th></tr></thead><tbody>{(data ?? []).map((j: any) => { const s = deriveStatus({ assignedAgent: j.core[1], assignedAt: j.core[4], duration: j.core[3], completed: j.core[5], disputed: j.core[6], expired: j.core[7] }, { completionRequested: j.val[0], completionRequestedAt: j.val[3], disputedAt: j.val[4] }); return <tr key={j.id} className="border-t border-border hover:bg-muted/30"><td><Link href={`/jobs/${j.id}${scenario ? `?scenario=${scenario}` : ''}`}>{j.id}</Link></td><td>{s.status}</td><td>{fmtToken(j.core[2])}</td><td>{fmtAddr(j.core[0])}</td><td>{fmtAddr(j.core[1])}</td></tr>; })}</tbody></table>
  </Card></div>;
}
