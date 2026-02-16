"use client";

import { useMemo, useState } from "react";

type FormState = {
  mail: string;
  company_name: string;
  business_type: "法人" | "個人事業主" | "";
  prefecture: string;
  city: string;
  industry_major: string;
  employee_count: string;
  capital_yen: string;
  established_ym: string; // YYYY-MM
  employment_insurance: "はい" | "いいえ" | "";
};

const initialState: FormState = {
  mail: "",
  company_name: "",
  business_type: "",
  prefecture: "",
  city: "",
  industry_major: "",
  employee_count: "",
  capital_yen: "",
  established_ym: "",
  employment_insurance: "",
};

function isValidYYYYMM(v: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export default function Page() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { type: "idle"; message?: string }
    | { type: "ok"; message: string }
    | { type: "ng"; message: string }
  >({ type: "idle" });

  // ★送信payload（内部だけで使用。UIには表示しない）
  const payload = useMemo(() => {
    return {
      mail: form.mail.trim(),
      "会社名": form.company_name.trim(),
      "法人／個人事業主区別": form.business_type,
      "都道府県": form.prefecture.trim(),
      "市区町村": form.city.trim(),
      "業種（大分類）": form.industry_major.trim(),
      "従業員数": form.employee_count ? Number(form.employee_count) : "",
      "資本金（円）": form.capital_yen ? Number(form.capital_yen) : "",
      "設立年月（YYYY-MM）": form.established_ym.trim(),
      "雇用保険加入（はい/いいえ）": form.employment_insurance,
      _meta: {
        source: "subsidy-form-ui",
        sent_at_iso: new Date().toISOString(),
      },
    };
  }, [form]);

  const errors = useMemo(() => {
    const e: string[] = [];
    const mail = form.mail.trim();

    if (!mail) e.push("メールアドレスは必須。");
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail))
      e.push("メールアドレス形式が変。");

    if (!form.company_name.trim()) e.push("会社名は必須。");
    if (!form.business_type) e.push("法人／個人事業主区別は必須。");
    if (!form.prefecture.trim()) e.push("都道府県は必須。");
    if (!form.city.trim()) e.push("市区町村は必須。");
    if (!form.industry_major.trim()) e.push("業種（大分類）は必須。");

    if (!form.employee_count.trim()) e.push("従業員数は必須。");
    if (form.employee_count && Number.isNaN(Number(form.employee_count)))
      e.push("従業員数は数字で入れろ。");

    if (!form.capital_yen.trim()) e.push("資本金（円）は必須。");
    if (form.capital_yen && Number.isNaN(Number(form.capital_yen)))
      e.push("資本金（円）は数字で入れろ。");

    if (!form.established_ym.trim()) e.push("設立年月（YYYY-MM）は必須。");
    if (form.established_ym && !isValidYYYYMM(form.established_ym))
      e.push("設立年月はYYYY-MMで入れろ（例：2023-03）。");

    if (!form.employment_insurance) e.push("雇用保険加入は必須。");

    return e;
  }, [form]);

  const reset = () => {
    setForm(initialState);
    setResult({ type: "idle" });
  };

  const submit = async () => {
    setResult({ type: "idle" });

    if (errors.length) {
      setResult({ type: "ng", message: errors.join(" ") });
      return;
    }

    setSubmitting(true);
    try {
      // ✅ CORS回避：同一オリジンのAPIへ投げる
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `送信に失敗（status: ${res.status}）`);
      }

      setResult({
        type: "ok",
        message: "送信完了。登録を受け付けた。",
      });
      setForm(initialState);
    } catch (err: unknown) {
      setResult({
        type: "ng",
        message: "送信失敗。時間を置いて再試行しろ。 " + getErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10">
      {/* 背景 */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#05010f]" />
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute -right-40 -top-20 h-[520px] w-[520px] rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute left-1/3 top-1/3 h-[620px] w-[620px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:28px_28px] opacity-40" />
      </div>

      <div className="mx-auto w-full max-w-5xl">
        {/* ヘッダー（短く） */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)]" />
              <h1 className="text-3xl font-extrabold tracking-wide text-white">
                Next Asia Link
              </h1>
            </div>
            <p className="mt-1 text-sm tracking-[0.20em] text-slate-300/70">
              COMPANY REGISTRATION • ALPHA
            </p>
          </div>

          <button
            onClick={reset}
            className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-bold text-fuchsia-200 hover:bg-fuchsia-500/15"
            type="button"
          >
            クリア
          </button>
        </div>

        {/* 本体カード */}
        <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-white/8 to-white/3 p-6 shadow-[0_0_40px_rgba(34,211,238,0.12)] backdrop-blur">
          <div>
            <h2 className="text-xl font-black tracking-widest text-white">
              会社情報入力
            </h2>
            {/* ★危険/不要文言は表示しない（ここは空に近い説明だけ） */}
            <p className="mt-1 text-sm text-slate-300/70">
              必須項目を入力して送信しろ。
            </p>
          </div>

          {/* フォーム */}
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="mail（メールアドレス）" required>
              <input
                value={form.mail}
                onChange={(e) => setForm({ ...form, mail: e.target.value })}
                placeholder="info@example.com"
                className={inputCls}
                inputMode="email"
                autoComplete="email"
              />
            </Field>

            <Field label="会社名" required>
              <input
                value={form.company_name}
                onChange={(e) =>
                  setForm({ ...form, company_name: e.target.value })
                }
                placeholder="株式会社〇〇"
                className={inputCls}
                autoComplete="organization"
              />
            </Field>

            <Field label="法人／個人事業主区別" required>
              <select
                value={form.business_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    business_type: e.target.value as FormState["business_type"],
                  })
                }
                className={inputCls}
              >
                <option value="">選択</option>
                <option value="法人">法人</option>
                <option value="個人事業主">個人事業主</option>
              </select>
            </Field>

            <Field label="都道府県" required>
              <input
                value={form.prefecture}
                onChange={(e) =>
                  setForm({ ...form, prefecture: e.target.value })
                }
                placeholder="東京都"
                className={inputCls}
              />
            </Field>

            <Field label="市区町村" required>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="中央区"
                className={inputCls}
              />
            </Field>

            <Field label="業種（大分類）" required>
              <input
                value={form.industry_major}
                onChange={(e) =>
                  setForm({ ...form, industry_major: e.target.value })
                }
                placeholder="情報通信業"
                className={inputCls}
              />
            </Field>

            <Field label="従業員数" required>
              <input
                value={form.employee_count}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employee_count: e.target.value.replace(/[^\d]/g, ""),
                  })
                }
                placeholder="5"
                className={inputCls}
                inputMode="numeric"
              />
            </Field>

            <Field label="資本金（円）" required>
              <input
                value={form.capital_yen}
                onChange={(e) =>
                  setForm({
                    ...form,
                    capital_yen: e.target.value.replace(/[^\d]/g, ""),
                  })
                }
                placeholder="3000000"
                className={inputCls}
                inputMode="numeric"
              />
            </Field>

            <Field label="設立年月（YYYY-MM）" required>
              <input
                value={form.established_ym}
                onChange={(e) =>
                  setForm({ ...form, established_ym: e.target.value })
                }
                placeholder="2023-03"
                className={inputCls}
              />
            </Field>

            <Field label="雇用保険加入（はい/いいえ）" required>
              <select
                value={form.employment_insurance}
                onChange={(e) =>
                  setForm({
                    ...form,
                    employment_insurance:
                      e.target.value as FormState["employment_insurance"],
                  })
                }
                className={inputCls}
              >
                <option value="">選択</option>
                <option value="はい">はい</option>
                <option value="いいえ">いいえ</option>
              </select>
            </Field>
          </div>

          {/* バリデーション（失敗する前に見せる。デバッグは見せない） */}
          {errors.length > 0 && result.type === "idle" && (
            <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              入力エラー：
              <ul className="mt-1 list-disc pl-5">
                {errors.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 結果 */}
          {result.type !== "idle" && (
            <div
              className={[
                "mt-5 rounded-xl border px-4 py-3 text-sm",
                result.type === "ok"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                  : "border-rose-400/30 bg-rose-400/10 text-rose-100",
              ].join(" ")}
            >
              {result.message}
            </div>
          )}

          {/* 送信ボタン */}
          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-7 py-3 font-extrabold tracking-widest text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.15)] hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
            >
              {submitting ? "送信中…" : "送信"}
            </button>
          </div>

          {/* 注意書き（必要なら残す。危険情報は載せない） */}
          <div className="mt-6 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-400/80">
            ※入力内容は登録・診断目的のみに使用します。採択・支給を保証するものではありません。
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-bold text-slate-100">{label}</span>
        {required && (
          <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-[2px] text-[10px] font-extrabold text-fuchsia-200">
            必須
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-cyan-300/15 bg-white/5 px-4 py-3 text-slate-100 placeholder:text-slate-400/60 outline-none ring-0 focus:border-cyan-300/40 focus:bg-white/7";