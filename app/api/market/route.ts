import { NextRequest, NextResponse } from "next/server"
import { StrKey } from "@stellar/stellar-sdk"
import { getListings, createListing, isPhase140Enabled, isPhaseEditionsEnabled, isPhaseCollabSplitsEnabled, isPhaseTimedDropsEnabled, isPhaseDutchAuctionEnabled, dropStatusForListing, currentDutchPrice } from "@/lib/market-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const collectionId = searchParams.get("collection")
  const sellerWallet = searchParams.get("seller")
  const sort = searchParams.get("sort") as "price_asc" | "price_desc" | "newest" | "edition_asc" | null
  const drop = searchParams.get("drop") as "live" | "upcoming" | "ended" | null
  const excludeAp = searchParams.get("exclude_ap") === "1"

  const listings = await getListings({
    collection_id: collectionId ? Number(collectionId) : undefined,
    seller_wallet: sellerWallet ?? undefined,
    sort: sort ?? "newest",
    drop: drop ?? undefined,
    exclude_artist_proof: excludeAp || undefined,
  })
  return NextResponse.json({ listings })
}

type CreateBody = {
  seller_wallet?: unknown
  token_id?: unknown
  collection_id?: unknown
  price_phaselq?: unknown
  accepts_offers?: unknown
  min_offer?: unknown
  image?: unknown
  name?: unknown
  creator_wallet?: unknown
  royalty_bps?: unknown
  edition_number?: unknown
  edition_size?: unknown
  is_artist_proof?: unknown
  supply_mode?: unknown
  drop_start_at?: unknown
  drop_end_at?: unknown
  dutch_start_price?: unknown
  dutch_floor_price?: unknown
  dutch_end_at?: unknown
  split_payees?: unknown
}

export async function POST(request: NextRequest) {
  let body: CreateBody
  try { body = (await request.json()) as CreateBody }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const seller_wallet = typeof body.seller_wallet === "string" ? body.seller_wallet.trim() : ""
  if (!seller_wallet || !StrKey.isValidEd25519PublicKey(seller_wallet)) {
    return NextResponse.json({ error: "valid seller_wallet required" }, { status: 400 })
  }

  const token_id = Number(body.token_id)
  const collection_id = Number(body.collection_id)
  const price_phaselq = Number(body.price_phaselq)

  if (!Number.isInteger(token_id) || token_id <= 0)
    return NextResponse.json({ error: "invalid token_id" }, { status: 400 })
  if (!Number.isInteger(collection_id) || collection_id < 0)
    return NextResponse.json({ error: "invalid collection_id" }, { status: 400 })
  if (!Number.isFinite(price_phaselq) || price_phaselq <= 0)
    return NextResponse.json({ error: "price_phaselq must be positive" }, { status: 400 })

  const min_offer = typeof body.min_offer === "number" ? body.min_offer : undefined

  // phase-140: creator/royalty on a listing are additive and only take
  // effect once the flag is on; a listing created with the flag off simply
  // carries no royalty and is never eligible for a split on resale.
  let creator_wallet: string | undefined
  let royalty_bps: number | undefined
  if (isPhase140Enabled() && typeof body.creator_wallet === "string" && body.creator_wallet.trim().length > 0) {
    const trimmed = body.creator_wallet.trim()
    if (!StrKey.isValidEd25519PublicKey(trimmed)) {
      return NextResponse.json({ error: "invalid creator_wallet" }, { status: 400 })
    }
    creator_wallet = trimmed
    const bps = Number(body.royalty_bps)
    if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) {
      return NextResponse.json({ error: "royalty_bps must be an integer 0-10000" }, { status: 400 })
    }
    royalty_bps = bps
  }

  // Spikes 673-675: optional flag-gated fields; validated in market-store (flag off → 400 via FLAG_DISABLED).
  const edition_number = typeof body.edition_number === "number" && Number.isInteger(body.edition_number) ? body.edition_number : undefined
  const edition_size = typeof body.edition_size === "number" && Number.isInteger(body.edition_size) ? body.edition_size : undefined
  const is_artist_proof = body.is_artist_proof === true ? true : undefined
  const supply_mode = body.supply_mode === "limited" || body.supply_mode === "open" ? body.supply_mode : undefined
  const drop_start_at = typeof body.drop_start_at === "number" && Number.isFinite(body.drop_start_at) ? body.drop_start_at : undefined
  const drop_end_at = typeof body.drop_end_at === "number" && Number.isFinite(body.drop_end_at) ? body.drop_end_at : undefined
  const dutch_start_price = typeof body.dutch_start_price === "number" && Number.isFinite(body.dutch_start_price) ? body.dutch_start_price : undefined
  const dutch_floor_price = typeof body.dutch_floor_price === "number" && Number.isFinite(body.dutch_floor_price) ? body.dutch_floor_price : undefined
  const dutch_end_at = typeof body.dutch_end_at === "number" && Number.isFinite(body.dutch_end_at) ? body.dutch_end_at : undefined
  const split_payees = Array.isArray(body.split_payees) ? (body.split_payees as Array<{ wallet: string; bps: number }>) : undefined

  try {
    const listing = await createListing({
      token_id,
      collection_id,
      seller_wallet,
      price_phaselq,
      accepts_offers: body.accepts_offers === true,
      min_offer,
      image: typeof body.image === "string" ? body.image : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      creator_wallet,
      royalty_bps,
      edition_number,
      edition_size,
      is_artist_proof,
      supply_mode,
      drop_start_at,
      drop_end_at,
      dutch_start_price,
      dutch_floor_price,
      dutch_end_at,
      split_payees,
    })
    return NextResponse.json({ listing }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = (e as { code?: string }).code
    if (code === "FLAG_DISABLED") return NextResponse.json({ error: msg }, { status: 400 })
    if (code === "VALIDATION_FAILED") return NextResponse.json({ error: msg }, { status: 400 })
    throw e
  }
}
