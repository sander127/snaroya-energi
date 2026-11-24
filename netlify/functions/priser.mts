import type { Config } from "@netlify/functions"

// Day-ahead spot prices (Nord Pool / ENTSO-E) per hour for one day and price area,
// fetched from the free hvakosterstrommen.no API and returned in øre/kWh excl. VAT.
//   GET /api/priser?dato=YYYY-MM-DD&omrade=NO1
// Tomorrow's prices are published around 13:00 Norwegian time. Until then the
// endpoint answers 404 with tilgjengelig: false.

type RawPrice = { NOK_per_kWh: number; EUR_per_kWh: number; EXR: number; time_start: string; time_end: string }

const AREAS = new Set(["NO1", "NO2", "NO3", "NO4", "NO5"])

function osloDate(offsetDays = 0, now = Date.now()): string {
  // "sv-SE" formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date(now + offsetDays * 86_400_000))
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export default async (req: Request) => {
  const url = new URL(req.url)
  const explicitDate = url.searchParams.get("dato")
  const dato = explicitDate ?? osloDate(0)
  const omrade = (url.searchParams.get("omrade") ?? "NO1").toUpperCase()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dato) || !AREAS.has(omrade)) {
    return Response.json({ feil: "Ugyldig dato (YYYY-MM-DD) eller prisområde (NO1–NO5)." }, { status: 400 })
  }

  const [y, m, d] = dato.split("-")
  const source = `https://www.hvakosterstrommen.no/api/v1/prices/${y}/${m}-${d}_${omrade}.json`

  let res: Response
  try {
    res = await fetch(source)
  } catch {
    return Response.json({ dato, omrade, tilgjengelig: false, melding: "Fikk ikke kontakt med priskilden." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    })
  }

  if (!res.ok) {
    return Response.json(
      { dato, omrade, tilgjengelig: false, melding: "Prisene for denne dagen er ikke publisert ennå. Morgendagens priser kommer ca. kl. 13." },
      {
        status: 404,
        headers: { "Cache-Control": "public, max-age=60", "Netlify-CDN-Cache-Control": "public, s-maxage=600" },
      },
    )
  }

  const raw = (await res.json()) as RawPrice[]
  const priser = raw.map((r) => ({ start: r.time_start, slutt: r.time_end, ore_per_kwh: round2(r.NOK_per_kWh * 100) }))
  const values = priser.map((p) => p.ore_per_kwh)
  const body = {
    dato,
    omrade,
    tilgjengelig: true,
    enhet: "øre/kWh eks. mva.",
    kilde: "hvakosterstrommen.no (day-ahead-priser fra ENTSO-E, samme auksjon som Nord Pool)",
    snitt: round2(values.reduce((a, b) => a + b, 0) / values.length),
    min: Math.min(...values),
    maks: Math.max(...values),
    priser,
  }

  // A published day's prices never change, so a dated request can be cached for a long time.
  // Requests without a date mean "today" and must expire quickly.
  const cdn = explicitDate ? "public, s-maxage=2592000, durable" : "public, s-maxage=300"
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=300", "Netlify-CDN-Cache-Control": cdn },
  })
}

export const config: Config = {
  path: "/api/priser",
}
