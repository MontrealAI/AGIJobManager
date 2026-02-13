const colors = ['--background','--foreground','--primary','--accent','--muted','--destructive'];

export default function DesignPage() {
  return <div className='container py-8 space-y-5'>
    <h1 className='font-serif text-4xl'>Design System Gallery</h1>
    <table className='w-full text-sm'><thead><tr><th>Token</th><th>Swatch</th></tr></thead><tbody>{colors.map((token) => <tr key={token}><td>{token}</td><td><div style={{background:`hsl(var(${token}))`}} className='h-8 rounded-md border border-border'/></td></tr>)}</tbody></table>
    <h2 className='font-serif text-2xl'>Typography Scale</h2>
    <div className='space-y-2'><p className='text-5xl'>Display 48</p><p className='text-3xl'>Heading 30</p><p className='text-xl'>Body 20</p><p className='text-sm'>Caption 14</p></div>
  </div>;
}
