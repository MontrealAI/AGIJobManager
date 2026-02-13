import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind')
  const address = req.nextUrl.searchParams.get('address')
  if (!kind || !address) return NextResponse.json({ error: 'missing params' }, { status: 400 })
  if (!process.env.MERKLE_ALLOWLIST_JSON) return NextResponse.json({ error: 'Merkle proof service not configured' }, { status: 501 })
  return NextResponse.json({ address, kind, proof: [] })
}
