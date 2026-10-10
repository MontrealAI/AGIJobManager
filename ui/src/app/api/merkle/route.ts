import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind');
  const address = req.nextUrl.searchParams.get('address');
  if (!kind || !address) return NextResponse.json({ error: 'kind and address are required' }, { status: 400 });
  // No proof backend is implemented. An empty proof is valid for some trees, so
  // returning one here would falsely claim eligibility rather than unavailability.
  return NextResponse.json({ error: 'Proof lookup is unavailable. Obtain a proof from the configured allowlist operator and paste it manually.' }, { status: 501 });
}
