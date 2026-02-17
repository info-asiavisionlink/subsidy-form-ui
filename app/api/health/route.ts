export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    time: new Date().toISOString(),
    gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
