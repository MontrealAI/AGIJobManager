import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind');
  const address = request.nextUrl.searchParams.get('address');
  if (!kind || !address) return NextResponse.json({ error: 'missing params' }, { status: 400 });
  return NextResponse.json({ error: 'proof helper not configured' }, { status: 501 });
}
