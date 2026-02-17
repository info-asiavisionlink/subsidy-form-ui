import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  jobId: string;
  status?: "running" | "done" | "error";
  progress?: number; // 0..100
  message?: string;
  result?: unknown;  // 最終結果JSON
  error?: string;
  secret?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    // 簡易認証（なりすまし防止）
    const secret = process.env.N8N_RESULT_CALLBACK_SECRET!;
    if (secret && body.secret !== secret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!body.jobId) {
      return NextResponse.json({ ok: false, error: "jobId required" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (body.status) patch.status = body.status;
    if (typeof body.progress === "number") patch.progress = Math.max(0, Math.min(100, body.progress));
    if (typeof body.message === "string") patch.message = body.message;
    if (typeof body.error === "string") patch.error = body.error;
    if (typeof body.result !== "undefined") patch.result = body.result;

    const { error } = await supabaseAdmin
      .from("subsidy_jobs")
      .update(patch)
      .eq("id", body.jobId);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}