import { Card } from '@/components/ui/card';

const colors = ['background', 'foreground', 'primary', 'secondary', 'accent', 'destructive', 'muted', 'border'];

export default function DesignPage() {
  return (
    <div className='container py-8 space-y-4'>
      <Card><h1 className='font-serif text-3xl'>Design System Gallery</h1><p>ASI Superintelligence Sovereign Purple tokens and components.</p></Card>
      <Card>
        <h2 className='font-serif text-xl'>Typography scale</h2>
        <table className='w-full text-sm'><tbody><tr><td>Display</td><td className='text-5xl font-serif'>Sovereign Title</td></tr><tr><td>Body</td><td className='text-base'>Operational copy with system fonts.</td></tr></tbody></table>
      </Card>
      <Card>
        <h2 className='font-serif text-xl'>Color tokens</h2>
        <div className='grid grid-cols-2 gap-2 md:grid-cols-4'>{colors.map((name) => <div key={name} className='rounded border p-2'><div className='h-12 rounded' style={{ background: `hsl(var(--${name}))` }} /><div className='mt-1 text-xs'>{name}</div></div>)}</div>
      </Card>
      <Card><h2 className='font-serif text-xl'>Controls</h2><div className='flex gap-2'><button className='rounded bg-primary px-3 py-2 text-primary-foreground'>Primary</button><button className='rounded border px-3 py-2'>Secondary</button><input className='rounded border px-3 py-2' placeholder='Input' /></div></Card>
    </div>
  );
}
