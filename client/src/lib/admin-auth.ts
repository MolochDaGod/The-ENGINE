export async function checkAdminSession() {
  try {
    const response = await fetch("/api/admin/session", {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) return false;
    const json = await response.json();
    return Boolean(json?.authenticated);
  } catch {
    return false;
  }
}

export async function loginAdmin(passcode: string) {
  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passcode }),
    });
    if (!response.ok) return false;
    const json = await response.json();
    return Boolean(json?.authenticated);
  } catch {
    return false;
  }
}

export async function logoutAdmin() {
  try {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
  } catch {
    // ignore
  }
}
