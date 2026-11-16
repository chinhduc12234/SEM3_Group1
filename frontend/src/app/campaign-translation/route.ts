import { NextResponse } from "next/server";

const cache = new Map<string, string>();
const MAX_INPUT_BYTES = 450;

function splitText(text: string) {
  const parts: string[] = [];
  let current = "";
  for (const word of text.split(/(\s+)/)) {
    if (new TextEncoder().encode(current + word).length > MAX_INPUT_BYTES && current) {
      parts.push(current);
      current = "";
    }
    current += word;
  }
  if (current) parts.push(current);
  return parts;
}

async function translatePart(text: string) {
  const key = text.trim();
  const existing = cache.get(key);
  if (existing) return existing;
  const query = new URLSearchParams({ q: text, langpair: "vi|en", mt: "1" });
  const response = await fetch("https://api.mymemory.translated.net/get?" + query, {
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Translation service is unavailable.");
  const payload = (await response.json()) as {
    responseStatus?: number;
    responseData?: { translatedText?: string };
  };
  const translated = payload.responseData?.translatedText;
  if (payload.responseStatus !== 200 || !translated)
    throw new Error("Translation service could not translate this text.");
  cache.set(key, translated);
  return translated;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 10000)
    return NextResponse.json({ error: "Text must contain 1 to 10000 characters." }, { status: 400 });

  try {
    const translated = await Promise.all(splitText(text).map(translatePart));
    return NextResponse.json({ text: translated.join("") });
  } catch {
    return NextResponse.json({ error: "Không thể dịch nội dung chiến dịch lúc này." }, { status: 502 });
  }
}
