import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "N8N_WEBHOOK_URL is not set" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, error: text || "Webhook error" },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}