const normalizedApiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function getAdminApiUrl(path: string) {
  if (!normalizedApiBase) return path;
  return `${normalizedApiBase}${path}`;
}

export async function checkAdminSession() {
  const response = await fetch(getAdminApiUrl("/api/admin/session"), {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) return false;
  const json = await response.json();
  return Boolean(json?.authenticated);
}

export async function loginAdmin(passcode: string) {
  const response = await fetch(getAdminApiUrl("/api/admin/login"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ passcode }),
  });

  if (!response.ok) return false;
  const json = await response.json();
  return Boolean(json?.authenticated);
}

export async function logoutAdmin() {
  await fetch(getAdminApiUrl("/api/admin/logout"), {
    method: "POST",
    credentials: "include",
  });
}
