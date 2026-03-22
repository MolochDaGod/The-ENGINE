import { Shield } from "lucide-react";
import { Link } from "wouter";

export default function AdminEntryButton() {
  return (
    <Link href="/admin-login">
      <button
        type="button"
        className="fixed bottom-4 right-4 z-50 rounded-full border border-[hsl(43,60%,30%)] bg-[hsl(225,25%,12%)]/90 px-3 py-2 text-xs font-semibold text-[hsl(45,30%,90%)] shadow-lg transition hover:bg-[hsl(225,25%,18%)] hover:text-[hsl(43,85%,55%)]"
        aria-label="Admin login"
      >
        <span className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" />
          Admin
        </span>
      </button>
    </Link>
  );
}
