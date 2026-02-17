import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    // 1) ジョブ作成
    const { data: job, error: insErr } = await supabaseAdmin
      .from("subsidy_jobs")
      .insert({
        status: "queued",
        progress: 0,
        message: "受付完了。診断を開始します。",
        payload,
      })
      .select("id")
      .single();

    if (insErr || !job) {
      return NextResponse.json({ ok: false, error: insErr?.message ?? "insert failed" }, { status: 500 });
    }

    // 2) n8nへ開始通知（jobIdを渡す）
    const n8nUrl = process.env.N8N_WEBHOOK_URL!;
    if (!n8nUrl) {
      return NextResponse.json({ ok: false, error: "N8N_WEBHOOK_URL が未設定" }, { status: 500 });
    }

    // n8n側で jobId を使って、途中経過や最終結果を /api/result に返す
    const fire = await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id, payload }),
      cache: "no-store",
    });

    const text = await fire.text().catch(() => "");

    if (!fire.ok) {
      // n8nが落ちてたらジョブをerrorに
      await supabaseAdmin
        .from("subsidy_jobs")
        .update({ status: "error", error: text || `n8n error ${fire.status}`, message: "起動に失敗しました" })
        .eq("id", job.id);

      return NextResponse.json({ ok: false, jobId: job.id, error: text || "n8n webhook error" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}