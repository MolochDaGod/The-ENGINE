/**
 * Solscan Pro API v2 — indexed mainnet account data.
 * Spec: https://pro-api.solscan.io/pro-api-docs/v2.0/reference/v2-account-detail
 *
 * Auth header is `token`, not Bearer. Key stays on Railway — never the browser.
 * Mainnet only (Solscan does not index testnet).
 */
const SOLSCAN_PRO = "https://pro-api.solscan.io/v2.0";

export type SolscanAccountDetail = {
  account: string;
  lamports: number;
  type: string;
  executable: boolean;
  owner_program: string;
  rent_epoch: number;
  is_oncurve: number;
};

function apiToken(): string | null {
  const t =
    process.env.SOLSCAN_API_TOKEN ||
    process.env.SOLSCAN_API_KEY ||
    process.env.SOLSCAN_PRO_TOKEN ||
    process.env.SOLSCAN_TOKEN ||
    "";
  return t.trim() || null;
}

export function solscanProConfigured(): boolean {
  return !!apiToken();
}

async function solscanGet<T>(path: string, query: Record<string, string>): Promise<T> {
  const token = apiToken();
  if (!token) {
    throw new Error("SOLSCAN_API_TOKEN not set on The-ENGINE");
  }
  const url = new URL(`${SOLSCAN_PRO}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      token,
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: T;
    errors?: { code?: number; message?: string };
  };
  if (!res.ok || body.success === false) {
    const msg = body.errors?.message || `Solscan HTTP ${res.status}`;
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return body.data as T;
}

/** GET /v2.0/account/detail?address= */
export async function solscanAccountDetail(
  address: string,
): Promise<SolscanAccountDetail> {
  return solscanGet<SolscanAccountDetail>("/account/detail", { address });
}
