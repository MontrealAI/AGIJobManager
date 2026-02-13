const tokens = ['--background','--foreground','--primary','--accent','--muted','--destructive'];

export default function DesignPage() {
  return <div className='container-shell py-8 space-y-4'>
    <h1 className='font-serif text-4xl'>Design System Gallery</h1>
    <section className='card-shell'><h2 className='font-serif text-2xl'>Typography</h2><table className='w-full text-sm mt-2'><tbody><tr><td>Display</td><td className='text-5xl font-serif'>Sovereign</td></tr><tr><td>Heading</td><td className='text-3xl font-serif'>Institutional heading</td></tr><tr><td>Body</td><td className='text-base'>Operational copy with tabular numerals 123456.</td></tr></tbody></table></section>
    <section className='card-shell'><h2 className='font-serif text-2xl'>Color tokens</h2><div className='grid grid-cols-2 md:grid-cols-3 gap-3 mt-2'>{tokens.map((t)=><div key={t} className='rounded border p-3'><div className='h-10 rounded' style={{background:`hsl(var(${t}))`}}/><p className='text-xs mt-2'>{t}</p></div>)}</div></section>
    <section className='card-shell'><h2 className='font-serif text-2xl'>Components</h2><div className='flex gap-2 flex-wrap mt-2'><button className='btn-primary'>Primary</button><button className='btn-outline'>Outline</button><span className='pill'>Status badge</span><input className='input-shell max-w-xs' placeholder='Input field' /></div></section>
  </div>;
}
