"use client";

import React, { useMemo, useState } from "react";

type FormState = {
  mail: string;
  company_name: string;
  business_type: "" | "法人" | "個人事業主";
  prefecture: string;
  city: string;
  industry: string;
  employee_count: string;
  capital_yen: string;
  established_ym: string; // YYYY-MM
  employment_insurance: "" | "はい" | "いいえ";
};

type ApiResult =
  | { ok: true; message: string }
  | { ok: false; message: string; details?: string };

const PREFECTURES: { jp: string; en: string }[] = [
  { jp: "北海道", en: "Hokkaido" },
  { jp: "青森県", en: "Aomori" },
  { jp: "岩手県", en: "Iwate" },
  { jp: "宮城県", en: "Miyagi" },
  { jp: "秋田県", en: "Akita" },
  { jp: "山形県", en: "Yamagata" },
  { jp: "福島県", en: "Fukushima" },
  { jp: "茨城県", en: "Ibaraki" },
  { jp: "栃木県", en: "Tochigi" },
  { jp: "群馬県", en: "Gunma" },
  { jp: "埼玉県", en: "Saitama" },
  { jp: "千葉県", en: "Chiba" },
  { jp: "東京都", en: "Tokyo" },
  { jp: "神奈川県", en: "Kanagawa" },
  { jp: "新潟県", en: "Niigata" },
  { jp: "富山県", en: "Toyama" },
  { jp: "石川県", en: "Ishikawa" },
  { jp: "福井県", en: "Fukui" },
  { jp: "山梨県", en: "Yamanashi" },
  { jp: "長野県", en: "Nagano" },
  { jp: "岐阜県", en: "Gifu" },
  { jp: "静岡県", en: "Shizuoka" },
  { jp: "愛知県", en: "Aichi" },
  { jp: "三重県", en: "Mie" },
  { jp: "滋賀県", en: "Shiga" },
  { jp: "京都府", en: "Kyoto" },
  { jp: "大阪府", en: "Osaka" },
  { jp: "兵庫県", en: "Hyogo" },
  { jp: "奈良県", en: "Nara" },
  { jp: "和歌山県", en: "Wakayama" },
  { jp: "鳥取県", en: "Tottori" },
  { jp: "島根県", en: "Shimane" },
  { jp: "岡山県", en: "Okayama" },
  { jp: "広島県", en: "Hiroshima" },
  { jp: "山口県", en: "Yamaguchi" },
  { jp: "徳島県", en: "Tokushima" },
  { jp: "香川県", en: "Kagawa" },
  { jp: "愛媛県", en: "Ehime" },
  { jp: "高知県", en: "Kochi" },
  { jp: "福岡県", en: "Fukuoka" },
  { jp: "佐賀県", en: "Saga" },
  { jp: "長崎県", en: "Nagasaki" },
  { jp: "熊本県", en: "Kumamoto" },
  { jp: "大分県", en: "Oita" },
  { jp: "宮崎県", en: "Miyazaki" },
  { jp: "鹿児島県", en: "Kagoshima" },
  { jp: "沖縄県", en: "Okinawa" },
];

const initialState: FormState = {
  mail: "",
  company_name: "",
  business_type: "",
  prefecture: "",
  city: "",
  industry: "",
  employee_count: "",
  capital_yen: "",
  established_ym: "",
  employment_insurance: "",
};

function isValidEmail(v: string) {
  const s = v.trim();
  if (!s) return false;
  // 雑に強いパターン（現場用）
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isYYYYMM(v: string) {
  const s = v.trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const [yStr, mStr] = s.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  return true;
}

function toNumberString(v: string) {
  return v.replace(/[^\d]/g, "");
}

export default function Page() {
  const [form, setForm] = useState<FormState>(initialState);

  // ★これが肝：初期はfalseなので、エラーは出さない
  const [submitted, setSubmitted] = useState(false);

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!isValidEmail(form.mail)) e.push("メールアドレスは必須。");
    if (!form.company_name.trim()) e.push("会社名は必須。");
    if (!form.business_type) e.push("法人／個人事業主区別は必須。");
    if (!form.prefecture.trim()) e.push("都道府県は必須。");
    if (!form.city.trim()) e.push("市区町村は必須。");
    if (!form.industry.trim()) e.push("業種（大分類）は必須。");
    if (!toNumberString(form.employee_count)) e.push("従業員数は必須。");
    if (!toNumberString(form.capital_yen)) e.push("資本金（円）は必須。");
    if (!isYYYYMM(form.established_ym)) e.push("設立年月（YYYY-MM）は必須。");
    if (!form.employment_insurance) e.push("雇用保険加入は必須。");
    return e;
  }, [form]);

  const canSubmit = errors.length === 0 && !sending;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // 入力中に「送信結果」を残すと邪魔なので消す
    setResult(null);
  }

  function clearForm() {
    setForm(initialState);
    setSubmitted(false); // ★クリアしたら初期状態へ戻す（エラー非表示）
    setSending(false);
    setResult(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // ★送信した瞬間にだけエラー表示を解禁
    setSubmitted(true);
    setResult(null);

    if (errors.length > 0) {
      setResult({ ok: false, message: "入力エラー。必須項目を埋めろ。" });
      return;
    }

    setSending(true);

    try {
      // UIでWebhookを見せない。API Route経由でCORS回避。
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mail: form.mail.trim(),
          company_name: form.company_name.trim(),
          business_type: form.business_type,
          prefecture: form.prefecture.trim(),
          city: form.city.trim(),
          industry: form.industry.trim(),
          employee_count: Number(toNumberString(form.employee_count)),
          capital_yen: Number(toNumberString(form.capital_yen)),
          established_ym: form.established_ym.trim(),
          employment_insurance: form.employment_insurance,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string; details?: string }
        | null;

      if (!res.ok || !data?.ok) {
        setResult({
          ok: false,
          message: data?.message || "送信失敗。時間を置いて再試行しろ。",
          details: data?.details,
        });
        return;
      }

      setResult({ ok: true, message: data.message || "送信完了。登録を受け付けた。" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, message: "送信失敗。ネットワークか設定を疑え。", details: msg });
    } finally {
      setSending(false);
    }
  }

  const showErrors = submitted && errors.length > 0; // ★ここが「最初は出さない」条件

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.14),transparent_55%),radial-gradient(circle_at_top_right,rgba(177,0,255,0.12),transparent_55%),linear-gradient(180deg,rgba(10,0,30,0.95),rgba(5,1,15,0.95))] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-cyan-300/20 bg-white/5 p-8 shadow-[0_0_40px_rgba(0,229,255,0.12)] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-wide">会社情報入力</h1>
              <p className="mt-2 text-sm text-slate-200/70">必須項目を入力して送信しろ。</p>
            </div>

            <button
              type="button"
              onClick={clearForm}
              className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-semibold text-fuchsia-100 hover:bg-fuchsia-500/20"
            >
              クリア
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field
              label="mail（メールアドレス）"
              required
              value={form.mail}
              placeholder="info@example.com"
              onChange={(v) => setField("mail", v)}
              type="email"
            />

            <Field
              label="会社名"
              required
              value={form.company_name}
              placeholder="株式会社〇〇"
              onChange={(v) => setField("company_name", v)}
            />

            <SelectField
              label="法人／個人事業主区別"
              required
              value={form.business_type}
              onChange={(v) => setField("business_type", v as FormState["business_type"])}
              options={[
                { value: "", label: "選択" },
                { value: "法人", label: "法人" },
                { value: "個人事業主", label: "個人事業主" },
              ]}
            />

            <SelectField
              label="都道府県"
              required
              value={form.prefecture}
              onChange={(v) => setField("prefecture", v)}
              options={[
                { value: "", label: "選択" },
                ...PREFECTURES.map((p) => ({
                  value: p.jp,
                  label: `${p.jp} — ${p.en}`,
                })),
              ]}
            />

            <Field
              label="市区町村"
              required
              value={form.city}
              placeholder="中央区"
              onChange={(v) => setField("city", v)}
            />

            <Field
              label="業種（大分類）"
              required
              value={form.industry}
              placeholder="情報通信業"
              onChange={(v) => setField("industry", v)}
            />

            <Field
              label="従業員数"
              required
              value={form.employee_count}
              placeholder="5"
              onChange={(v) => setField("employee_count", toNumberString(v))}
              inputMode="numeric"
            />

            <Field
              label="資本金（円）"
              required
              value={form.capital_yen}
              placeholder="3000000"
              onChange={(v) => setField("capital_yen", toNumberString(v))}
              inputMode="numeric"
            />

            <Field
              label="設立年月（YYYY-MM）"
              required
              value={form.established_ym}
              placeholder="2023-03"
              onChange={(v) => setField("established_ym", v)}
            />

            <SelectField
              label="雇用保険加入（はい/いいえ）"
              required
              value={form.employment_insurance}
              onChange={(v) => setField("employment_insurance", v as FormState["employment_insurance"])}
              options={[
                { value: "", label: "選択" },
                { value: "はい", label: "はい" },
                { value: "いいえ", label: "いいえ" },
              ]}
            />

            {/* アクション */}
            <div className="md:col-span-2 mt-2 flex flex-col items-end gap-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-2xl border border-cyan-200/20 bg-cyan-500/10 px-10 py-3 text-base font-extrabold tracking-widest text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.15)] hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "送信中…" : "送信"}
              </button>

              <p className="text-xs text-slate-200/45">
                ※入力内容は登録・診断目的のみに使用。採択・支給を保証するものではない。
              </p>
            </div>

            {/* ★エラーは「送信後だけ」出す */}
            {showErrors && (
              <div className="md:col-span-2 rounded-2xl border border-amber-300/25 bg-amber-200/10 p-5 text-amber-100">
                <div className="font-extrabold">入力エラー：</div>
                <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-amber-50/90">
                  {errors.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 結果 */}
            {result && (
              <div
                className={[
                  "md:col-span-2 rounded-2xl border p-5",
                  result.ok
                    ? "border-emerald-300/25 bg-emerald-200/10 text-emerald-100"
                    : "border-rose-300/25 bg-rose-200/10 text-rose-100",
                ].join(" ")}
              >
                <div className="font-extrabold">{result.ok ? "送信完了。" : "送信失敗。"}</div>
                <div className="mt-2 text-sm text-slate-100/90">{result.message}</div>

                {/* detailsはUIで露出しすぎない（最小限） */}
                {!result.ok && result.details && (
                  <details className="mt-3 text-xs text-slate-100/70">
                    <summary className="cursor-pointer select-none">詳細（デバッグ）</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-black/30 p-3">
                      {result.details}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

function Field(props: {
  label: string;
  required?: boolean;
  value: string;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100/90">
        <span>{props.label}</span>
        {props.required && (
          <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-extrabold text-fuchsia-100">
            必須
          </span>
        )}
      </div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        type={props.type || "text"}
        inputMode={props.inputMode}
        className="w-full rounded-2xl border border-cyan-200/15 bg-white/5 px-4 py-3 text-slate-100 outline-none ring-0 placeholder:text-slate-200/35 focus:border-cyan-200/30"
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  required?: boolean;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100/90">
        <span>{props.label}</span>
        {props.required && (
          <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-extrabold text-fuchsia-100">
            必須
          </span>
        )}
      </div>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="w-full rounded-2xl border border-cyan-200/15 bg-white/5 px-4 py-3 text-slate-100 outline-none ring-0 focus:border-cyan-200/30"
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-950">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}