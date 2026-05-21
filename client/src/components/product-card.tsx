import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PortalProduct } from "@/data/portalProducts";

const STATUS_CLASSES: Record<string, string> = {
  live: "bg-[hsl(120,60%,50%)]/15 text-[hsl(120,60%,60%)] border-[hsl(120,60%,50%)]/30",
  planned: "bg-[hsl(43,85%,55%)]/15 text-[hsl(43,85%,55%)] border-[hsl(43,85%,55%)]/30",
  beta: "bg-[hsl(280,70%,60%)]/15 text-[hsl(280,70%,70%)] border-[hsl(280,70%,60%)]/30",
  admin: "bg-[hsl(0,60%,55%)]/15 text-[hsl(0,70%,70%)] border-[hsl(0,60%,55%)]/30",
};

export function ProductCard({ product }: { product: PortalProduct }) {
  const outerStyle = product.image
    ? {
        backgroundImage: `linear-gradient(to bottom, hsla(225,30%,8%,0.55), hsla(225,30%,6%,0.92)), url(${product.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  const hoverStyle = product.image
    ? {
        backgroundImage: `linear-gradient(to bottom, hsla(225,30%,8%,0.35), hsla(225,30%,6%,0.85)), url(${product.image})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  const body = (
    <div className="h-full fantasy-panel p-5 hover:rune-glow transition-all flex flex-col justify-between relative overflow-hidden group" style={outerStyle}>
      {product.image && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={hoverStyle} />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-heading text-lg text-[hsl(45,30%,92%)]" style={{ WebkitTextFillColor: "unset" }}>{product.name}</h3>
          <Badge className={`border text-[10px] uppercase tracking-wide ${STATUS_CLASSES[product.status]}`}>{product.status}</Badge>
        </div>
        <p className="text-sm text-[hsl(45,15%,60%)] font-body">{product.description}</p>
        {(product.authRequired || product.note) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {product.authRequired && (
              <Badge variant="outline" className="border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)]">Grudge ID</Badge>
            )}
            {product.note && (
              <Badge variant="outline" className="border-[hsl(220,15%,25%)] text-[hsl(45,15%,60%)]">{product.note}</Badge>
            )}
          </div>
        )}
      </div>
      <div className="relative z-10 mt-5 flex items-center text-sm text-[hsl(43,85%,55%)] font-medium">
        Open product <ArrowUpRight className="w-4 h-4 ml-1" />
      </div>
    </div>
  );

  if (product.external) {
    return (
      <a href={product.href} target="_blank" rel="noopener noreferrer" className="block h-full">{body}</a>
    );
  }

  return (
    <Link href={product.href} className="block h-full">{body}</Link>
  );
}
