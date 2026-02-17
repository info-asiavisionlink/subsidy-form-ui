"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type FormState = {
  mail: string;
  companyName: string;
  entityType: "法人" | "個人事業主" | "";
  prefecture: string;
  city: string;
  industryMajor: string;
  employeeCount: string;
  capitalYen: string;
  foundedYm: string; // YYYY-MM
  employmentInsurance: "はい" | "いいえ" | "";
};

type FieldErrorMap = Partial<Record<keyof FormState, string>>;
type UiPhase = "idle" | "submitting" | "streaming" | "done" | "error";

type StreamLine = { ts: number; text: string };

type StreamResultPayload = {
  title?: string;
  summary?: string;
  resultText?: string;
  markdown?: string;
  raw?: unknown;
};

const PREFS = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県",
  "三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

const INDUSTRY_MAJOR = [
  "情報通信業",
  "建設業",
  "製造業",
  "卸売・小売業",
  "宿泊・飲食サービス業",
  "医療・福祉",
  "運輸業",
  "教育・学習支援業",
  "サービス業（他に分類されないもの）",
  "その他",
];

function isEmailLike(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}
function formatYenLike(v: string) {
  const d = onlyDigits(v);
  if (!d) return "";
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
function normalizeYenInput(v: string) {
  return onlyDigits(v);
}

function buildErrors(s: FormState): FieldErrorMap {
  const e: FieldErrorMap = {};

  if (!s.mail.trim()) e.mail = "メールアドレスは必須。";
  else if (!isEmailLike(s.mail)) e.mail = "メール形式が変。";

  if (!s.companyName.trim()) e.companyName = "会社名は必須。";

  if (!s.entityType) e.entityType = "法人/個人事業主を選べ。";

  if (!s.prefecture) e.prefecture = "都道府県は必須。";

  if (!s.city.trim()) e.city = "市区町村は必須。";

  if (!s.industryMajor) e.industryMajor = "業種（大分類）は必須。";

  if (!s.employeeCount.trim()) e.employeeCount = "従業員数は必須。";
  else if (!/^\d+$/.test(s.employeeCount)) e.employeeCount = "従業員数は数字だけ。";

  if (!s.capitalYen.trim()) e.capitalYen = "資本金は必須。";
  else if (!/^\d+$/.test(s.capitalYen)) e.capitalYen = "資本金は数字だけ。";

  if (!s.foundedYm.trim()) e.foundedYm = "設立年月（YYYY-MM）は必須。";
  else if (!/^\d{4}-\d{2}$/.test(s.foundedYm)) e.foundedYm = "設立年月の形式が違う。";

  if (!s.employmentInsurance) e.employmentInsurance = "雇用保険加入を選べ。";

  return e;
}
function hasAnyError(map: FieldErrorMap) {
  return Object.keys(map).length > 0;
}

/** ✅ これを Page の外に出す（レンダー中に生成しない） */
function Field(props: {
  label: string;
  required?: boolean;
  showError: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-white/90">{props.label}</div>
        {props.required ? (
          <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-200">
            必須
          </span>
        ) : null}
      </div>
      {props.children}
      {props.showError && props.error ? (
        <div className="text-xs text-red-300">{props.error}</div>
      ) : null}
    </div>
  );
}

export default function Page() {
  const [form, setForm] = useState<FormState>({
    mail: "",
    companyName: "",
    entityType: "",
    prefecture: "",
    city: "",
    industryMajor: "",
    employeeCount: "",
    capitalYen: "",
    foundedYm: "",
    employmentInsurance: "",
  });

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [jobId, setJobId] = useState<string>("");
  const [streamLines, setStreamLines] = useState<StreamLine[]>([]);
  const [result, setResult] = useState<StreamResultPayload | null>(null);
  const [fatalError, setFatalError] = useState<string>("");

  const esRef = useRef<EventSource | null>(null);

  const errors = useMemo(() => buildErrors(form), [form]);
  const canSubmit = useMemo(() => !hasAnyError(errors), [errors]);

  const showFieldError = submitAttempted;
  const showErrorPanel = submitAttempted && hasAnyError(errors);

  function closeStream() {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
  }
  useEffect(() => closeStream, []);

  function pushLine(text: string) {
    setStreamLines((prev) => {
      const next = [...prev, { ts: Date.now(), text }];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setSubmitAttempted(true);
    setFatalError("");
    setResult(null);
    setStreamLines([]);
    setJobId("");

    if (!canSubmit) {
      setPhase("idle");
      return;
    }

    setPhase("submitting");

    const payload = {
      mail: form.mail.trim(),
      companyName: form.companyName.trim(),
      entityType: form.entityType,
      prefecture: form.prefecture,
      city: form.city.trim(),
      industryMajor: form.industryMajor,
      employeeCount: Number(form.employeeCount),
      capitalYen: Number(form.capitalYen),
      foundedYm: form.foundedYm,
      employmentInsurance: form.employmentInsurance,
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; jobId?: string; error?: string }
        | null;

      if (!res.ok || !data?.ok || !data.jobId) {
        const msg = data?.error || `submit failed: ${res.status}`;
        setFatalError(msg);
        setPhase("error");
        return;
      }

      setJobId(data.jobId);
      setPhase("streaming");

      closeStream();
      pushLine("診断を開始した。");
      pushLine("診断中…");

      const url = `/api/stream?jobId=${encodeURIComponent(data.jobId)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("open", () => pushLine("ストリーム接続OK。"));

      es.addEventListener("log", (ev) => {
        const msg = (ev as MessageEvent<string>).data;
        if (typeof msg === "string" && msg.trim()) pushLine(msg);
      });

      es.addEventListener("result", (ev) => {
        const raw = (ev as MessageEvent<string>).data;
        let parsed: StreamResultPayload;

        try {
          parsed = JSON.parse(raw) as StreamResultPayload;
        } catch {
          parsed = { resultText: String(raw) };
        }

        setResult(parsed);
        pushLine("診断完了。");
        setPhase("done");
        closeStream();
      });

      es.addEventListener("error", (ev) => {
        const raw = (ev as MessageEvent<string>).data;
        const msg = raw ? String(raw) : "ストリームエラー。";
        setFatalError(msg);
        pushLine(`エラー: ${msg}`);
        setPhase("error");
        closeStream();
      });

      es.onerror = () => {
        // ネットワーク切断でも来る。再接続で沼るより止める。
        if (phase !== "done") {
          setFatalError("ストリームが切断された。");
          pushLine("ストリーム切断。");
          setPhase("error");
          closeStream();
        }
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setFatalError(msg);
      setPhase("error");
    }
  }

  return (
    <main className="min-h-screen w-full bg-[#05040a] text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-8 shadow-2xl">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute -left-20 -top-24 h-80 w-80 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className="absolute -right-24 -bottom-32 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-3xl" />
          </div>

          <div className="relative">
            <h1 className="text-2xl font-black tracking-tight">会社情報入力</h1>
            <p className="mt-1 text-sm text-white/70">必須項目を入力して送信しろ。</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Field label="mail（メールアドレス）" required showError={showFieldError} error={errors.mail}>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
                    placeholder="info@example.com"
                    value={form.mail}
                    onChange={(ev) => setForm((p) => ({ ...p, mail: ev.target.value }))}
                    autoComplete="email"
                    inputMode="email"
                  />
                </Field>

                <Field label="会社名" required showError={showFieldError} error={errors.companyName}>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
                    placeholder="株式会社〇〇"
                    value={form.companyName}
                    onChange={(ev) => setForm((p) => ({ ...p, companyName: ev.target.value }))}
                  />
                </Field>

                <Field label="法人／個人事業主区別" required showError={showFieldError} error={errors.entityType}>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                    value={form.entityType}
                    onChange={(ev) =>
                      setForm((p) => ({ ...p, entityType: ev.target.value as FormState["entityType"] }))
                    }
                  >
                    <option value="" className="bg-[#0b0a12]">選択</option>
                    <option value="法人" className="bg-[#0b0a12]">法人</option>
                    <option value="個人事業主" className="bg-[#0b0a12]">個人事業主</option>
                  </select>
                </Field>

                <Field label="都道府県" required showError={showFieldError} error={errors.prefecture}>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                    value={form.prefecture}
                    onChange={(ev) => setForm((p) => ({ ...p, prefecture: ev.target.value }))}
                  >
                    <option value="" className="bg-[#0b0a12]">選択</option>
                    {PREFS.map((p) => (
                      <option key={p} value={p} className="bg-[#0b0a12]">{p}</option>
                    ))}
                  </select>
                </Field>

                <Field label="市区町村" required showError={showFieldError} error={errors.city}>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
                    placeholder="中央区"
                    value={form.city}
                    onChange={(ev) => setForm((p) => ({ ...p, city: ev.target.value }))}
                  />
                </Field>

                <Field label="業種（大分類）" required showError={showFieldError} error={errors.industryMajor}>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                    value={form.industryMajor}
                    onChange={(ev) => setForm((p) => ({ ...p, industryMajor: ev.target.value }))}
                  >
                    <option value="" className="bg-[#0b0a12]">選択</option>
                    {INDUSTRY_MAJOR.map((x) => (
                      <option key={x} value={x} className="bg-[#0b0a12]">{x}</option>
                    ))}
                  </select>
                </Field>

                <Field label="従業員数" required showError={showFieldError} error={errors.employeeCount}>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
                    placeholder="5"
                    value={form.employeeCount}
                    onChange={(ev) => setForm((p) => ({ ...p, employeeCount: onlyDigits(ev.target.value) }))}
                    inputMode="numeric"
                  />
                </Field>

                <Field label="資本金（円）" required showError={showFieldError} error={errors.capitalYen}>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
                    placeholder="3000000"
                    value={formatYenLike(form.capitalYen)}
                    onChange={(ev) => setForm((p) => ({ ...p, capitalYen: normalizeYenInput(ev.target.value) }))}
                    inputMode="numeric"
                  />
                </Field>

                <Field label="設立年月（YYYY-MM）" required showError={showFieldError} error={errors.foundedYm}>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-cyan-300/40"
                    placeholder="2023-03"
                    value={form.foundedYm}
                    onChange={(ev) => setForm((p) => ({ ...p, foundedYm: ev.target.value }))}
                  />
                </Field>

                <Field label="雇用保険加入（はい／いいえ）" required showError={showFieldError} error={errors.employmentInsurance}>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300/40"
                    value={form.employmentInsurance}
                    onChange={(ev) =>
                      setForm((p) => ({
                        ...p,
                        employmentInsurance: ev.target.value as FormState["employmentInsurance"],
                      }))
                    }
                  >
                    <option value="" className="bg-[#0b0a12]">選択</option>
                    <option value="はい" className="bg-[#0b0a12]">はい</option>
                    <option value="いいえ" className="bg-[#0b0a12]">いいえ</option>
                  </select>
                </Field>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={phase === "submitting" || phase === "streaming"}
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-6 py-3 text-sm font-black text-black shadow-lg shadow-fuchsia-500/10 disabled:opacity-50"
                >
                  {phase === "submitting" ? "送信中…" : phase === "streaming" ? "診断中…" : "送信"}
                </button>

                <div className="text-xs text-white/60">
                  {jobId ? (
                    <span>
                      jobId: <span className="text-white/80">{jobId}</span>
                    </span>
                  ) : (
                    <span>送信すると診断が始まる。</span>
                  )}
                </div>
              </div>

              {showErrorPanel ? (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5">
                  <div className="text-sm font-black text-red-200">入力エラー：</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-100/90">
                    {Object.values(errors).map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(phase === "streaming" || phase === "done" || phase === "error") ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-black">診断ログ（ライブ）</div>
                    <button
                      type="button"
                      className="text-xs text-white/60 hover:text-white/90"
                      onClick={() => setStreamLines([])}
                    >
                      クリア
                    </button>
                  </div>

                  <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-5 text-white/80">
                    {streamLines.length === 0 ? (
                      <div className="text-white/50">まだ何も来てない。</div>
                    ) : (
                      streamLines.map((l, idx) => (
                        <div key={idx}>
                          <span className="text-white/40">
                            [{new Date(l.ts).toLocaleTimeString()}]
                          </span>{" "}
                          {l.text}
                        </div>
                      ))
                    )}
                  </div>

                  {fatalError ? (
                    <div className="mt-3 text-xs text-red-300">エラー: {fatalError}</div>
                  ) : null}
                </div>
              ) : null}

              {result ? (
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/0 p-6">
                  <div className="text-lg font-black">{result.title ?? "診断結果"}</div>
                  {result.summary ? (
                    <div className="mt-2 text-sm text-white/80">{result.summary}</div>
                  ) : null}

                  <div className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/85">
                    {result.markdown ?? result.resultText ?? JSON.stringify(result.raw ?? result, null, 2)}
                  </div>
                </div>
              ) : null}
            </form>
          </div>
        </div>

        <footer className="mt-6 text-center text-xs text-white/35">
          SSE（エスエスイー）で結果を返す。ポーリングしない。気持ちよさ優先。
        </footer>
      </div>
    </main>
  );
}