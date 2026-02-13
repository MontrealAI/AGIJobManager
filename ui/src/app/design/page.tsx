import { Card } from '@/components/ui/card';

const tokens = ['--background', '--foreground', '--primary', '--accent', '--muted', '--destructive'];

export default function DesignPage() {
  return (
    <div className="container py-8 space-y-4">
      <h1 className="font-serif text-4xl">Design system gallery</h1>
      <Card>
        <h2 className="font-serif text-2xl">Typography scale</h2>
        <table className="w-full text-sm"><thead><tr><th>Token</th><th>Sample</th></tr></thead><tbody><tr><td>Display</td><td className="text-5xl font-serif">Sovereign Purple</td></tr><tr><td>Body</td><td className="text-base">Institutional and readable.</td></tr></tbody></table>
      </Card>
      <Card>
        <h2 className="font-serif text-2xl">Color tokens</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{tokens.map((t) => <div key={t} className="border border-border rounded-md p-2"><div className="h-14 rounded" style={{ background: `hsl(var(${t}))` }} /><p className="text-xs mt-2">{t}</p></div>)}</div>
      </Card>
      <Card><h2 className="font-serif text-2xl">Components</h2><button className="px-3 py-2 rounded-md bg-primary text-primary-foreground">Primary button</button></Card>
    </div>
  );
}
