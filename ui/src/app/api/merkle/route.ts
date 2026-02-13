import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest){
  const kind = req.nextUrl.searchParams.get('kind');
  const address = req.nextUrl.searchParams.get('address');
  if (!kind || !address) return NextResponse.json({ error: 'kind and address are required' }, { status: 400 });
  if (!process.env.MERKLE_PROOF_SERVICE_URL) return NextResponse.json({ error: 'Proof service not configured. Paste proof manually.' }, { status: 501 });
  return NextResponse.json({ kind, address, proof: [] });
}
