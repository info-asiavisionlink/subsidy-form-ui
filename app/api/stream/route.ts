import { NextResponse } from "next/server";
import { supabaseAdmin } from "../_lib/supabaseAdmin";

type JobRow = {
  id: string;
  status: "queued" | "running" | "done" | "error" | string;
  logs: string[] | null;
  result: unknown | null;
  error: string | null;
  updated_at?: string | null;
};

function sse(data: string, event?: string) {
  // event と data をSSE形式に整形
  const ev = event ? `event: ${event}\n` : "";
  return `${ev}data: ${data}\n\n`;
}

function safeJson(x: unknown) {
  try {
    return JSON.stringify(x);
  } catch {
    return JSON.stringify({ error: "json_stringify_failed" });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId") ?? "";

  if (!jobId) {
    return new NextResponse("missing jobId", { status: 400 });
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  let closed = false;
  const write = async (chunk: string) => {
    if (closed) return;
    await writer.write(encoder.encode(chunk));
  };

  // 初期メッセージ
  await write(sse("connected", "log"));

  // まず現状を1回読む（ログの初期表示用）
  {
    const { data, error } = await supabaseAdmin
      .from("subsidy_jobs")
      .select("id,status,logs,result,error,updated_at")
      .eq("id", jobId)
      .maybeSingle<JobRow>();

    if (error || !data) {
      await write(sse(error?.message ?? "job not found", "error"));
      await writer.close();
      closed = true;
      return new NextResponse(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    if (Array.isArray(data.logs)) {
      for (const line of data.logs) {
        if (typeof line === "string" && line.trim()) {
          await write(sse(line, "log"));
        }
      }
    }

    if (data.status === "done" && data.result != null) {
      await write(sse(safeJson(data.result), "result"));
      await writer.close();
      closed = true;
      return new NextResponse(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    if (data.status === "error") {
      await write(sse(data.error ?? "job error", "error"));
      await writer.close();
      closed = true;
      return new NextResponse(stream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }
  }

  // ここから Realtime（リアルタイム）でDB更新を拾う
  // ポーリング禁止 → WebSocketで来た更新をSSEに流す
  const channel = supabaseAdmin
    .channel(`job:${jobId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "subsidy_jobs",
        filter: `id=eq.${jobId}`,
      },
      async (payload: unknown) => {
        // payload は unknown で受けて、必要分だけ安全に読む
        const p = payload as { new?: unknown };
        const n = p?.new as Partial<JobRow> | undefined;

        if (!n) return;

        if (Array.isArray(n.logs)) {
          // logs丸ごと来る設計なら、最後の1行だけ吐くなどに変えるのが理想
          // ここは安全に「増分っぽく」最後だけ流す
          const last = n.logs[n.logs.length - 1];
          if (typeof last === "string" && last.trim()) {
            await write(sse(last, "log"));
          }
        }

        if (n.status === "error") {
          await write(sse(n.error ?? "job error", "error"));
          await writer.close();
          closed = true;
          supabaseAdmin.removeChannel(channel);
          return;
        }

        if (n.status === "done" && n.result != null) {
          await write(sse(safeJson(n.result), "result"));
          await writer.close();
          closed = true;
          supabaseAdmin.removeChannel(channel);
          return;
        }
      }
    )
    .subscribe();

  // クライアントが切断したら後片付け
  req.signal.addEventListener("abort", async () => {
    try {
      supabaseAdmin.removeChannel(channel);
    } finally {
      if (!closed) {
        closed = true;
        try {
          await writer.close();
        } catch {
          // ignore
        }
      }
    }
  });

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}