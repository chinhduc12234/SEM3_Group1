import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length > 200) return NextResponse.json({ error: "Địa điểm không hợp lệ." }, { status: 400 });
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "10");
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return NextResponse.json({ error: "Dịch vụ địa điểm không phản hồi." }, { status: 502 });
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ error: "Không thể kết nối dịch vụ địa điểm." }, { status: 502 });
  }
}
