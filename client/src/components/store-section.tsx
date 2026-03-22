import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, CreditCard, Wallet, Bitcoin, Gamepad2, Code, Swords, Sparkles, Shield, Server, Image } from "lucide-react";
import type { StoreProduct } from "@shared/schema";
import PaymentForm from "./payment-form";

const CATEGORY_META: Record<string, { label: string; badgeClass: string; heading: string }> = {
  software: { label: 'Game Engine', badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', heading: 'Game Engines & Software' },
  enterprise: { label: 'Custom Service', badgeClass: 'bg-purple-500/20 text-purple-400 border-purple-500/30', heading: 'Custom Development' },
  asset: { label: 'Art Asset', badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30', heading: 'Art & Environment Packs' },
};

export default function StoreSection() {
  const { toast } = useToast();
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  const { data: products = [], isLoading } = useQuery<StoreProduct[]>({
    queryKey: ["/api/store/products"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: { customerEmail: string; productId: number; paymentMethod: string }) => {
      const response = await apiRequest("POST", "/api/store/orders", {
        ...data,
        amount: products.find(p => p.id === data.productId)?.price || 0,
        paymentStatus: "pending",
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Order Created", description: "Your order has been created. You will be redirected to payment." });
      queryClient.invalidateQueries({ queryKey: ["/api/store/orders"] });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const formatPrice = (priceInCents: number) => {
    if (priceInCents >= 100000) return `$${(priceInCents / 100).toLocaleString()}`;
    return `$${(priceInCents / 100).toFixed(0)}`;
  };

  const engines = products.filter(p => p.category === 'software');
  const enterprise = products.filter(p => p.category === 'enterprise');
  const assets = products.filter(p => p.category === 'asset');

  const renderProductCard = (product: StoreProduct, size: 'large' | 'small' = 'large') => {
    const meta = CATEGORY_META[product.category] || CATEGORY_META.software;
    const isSmall = size === 'small';

    return (
      <Card key={product.id} className="border-[hsl(43,60%,30%)]/30 bg-[hsl(225,28%,12%)] hover:border-[hsl(43,85%,55%)]/50 transition-all overflow-hidden group flex flex-col">
        <div className={`relative ${isSmall ? 'h-40' : 'h-52'} overflow-hidden`}>
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(225,25%,15%), hsl(225,30%,10%))' }}>
              <Image className="w-16 h-16 text-[hsl(43,60%,30%)]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(225,28%,12%)] via-transparent to-transparent" />
          <Badge className={`absolute top-3 left-3 ${meta.badgeClass} border text-xs`}>
            {meta.label}
          </Badge>
          <div className="absolute bottom-3 right-3">
            <span className="text-xl font-bold text-[hsl(43,85%,55%)] drop-shadow-lg">
              {formatPrice(product.price)}
            </span>
          </div>
        </div>

        <CardContent className={`${isSmall ? 'p-4' : 'p-6'} flex flex-col flex-1`}>
          <h3 className={`${isSmall ? 'text-base' : 'text-xl'} font-heading text-[hsl(45,30%,90%)] mb-2`} style={{ WebkitTextFillColor: 'unset' }}>
            {product.name}
          </h3>
          
          <p className={`text-[hsl(45,15%,55%)] mb-4 ${isSmall ? 'text-xs' : 'text-sm'} leading-relaxed flex-1`}>
            {product.description}
          </p>
          
          {!isSmall && (
            <div className="space-y-2 mb-5">
              {product.features?.map((feature, index) => (
                <div key={index} className="flex items-start text-sm text-[hsl(45,15%,65%)]">
                  <Check className="text-emerald-400 mr-2 h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          )}
          
          <Button
            className="w-full gilded-button"
            size={isSmall ? 'sm' : 'default'}
            onClick={() => setSelectedProduct(product)}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {product.category === "enterprise" ? "Contact Sales" : `Buy — ${formatPrice(product.price)}`}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-heading gold-text font-bold mb-4">Digital Store</h2>
          <p className="text-lg text-[hsl(45,15%,55%)] font-body max-w-2xl mx-auto">
            Game engines, retro libraries, environment art, and custom development — everything you need to build or play
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-[hsl(43,60%,30%)]/20 bg-[hsl(225,28%,12%)]">
                <CardContent className="p-0">
                  <div className="h-52 bg-[hsl(225,25%,15%)] rounded-t-lg animate-pulse" />
                  <div className="p-6 space-y-4">
                    <div className="h-4 bg-[hsl(225,25%,20%)] rounded w-1/3" />
                    <div className="h-6 bg-[hsl(225,25%,20%)] rounded w-2/3" />
                    <div className="h-16 bg-[hsl(225,25%,20%)] rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {engines.length > 0 && (
              <div className="mb-16">
                <h3 className="text-2xl font-heading text-[hsl(43,85%,65%)] mb-6 flex items-center gap-3" style={{ WebkitTextFillColor: 'unset' }}>
                  <Gamepad2 className="w-6 h-6 text-[hsl(43,85%,55%)]" />
                  Game Engines & Software
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {engines.map((p) => renderProductCard(p, 'large'))}
                </div>
              </div>
            )}

            {enterprise.length > 0 && (
              <div className="mb-16">
                <h3 className="text-2xl font-heading text-[hsl(43,85%,65%)] mb-6 flex items-center gap-3" style={{ WebkitTextFillColor: 'unset' }}>
                  <Swords className="w-6 h-6 text-[hsl(43,85%,55%)]" />
                  Custom Development
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enterprise.map((p) => renderProductCard(p, 'large'))}
                </div>
              </div>
            )}

            {assets.length > 0 && (
              <div className="mb-16">
                <h3 className="text-2xl font-heading text-[hsl(43,85%,65%)] mb-6 flex items-center gap-3" style={{ WebkitTextFillColor: 'unset' }}>
                  <Sparkles className="w-6 h-6 text-[hsl(43,85%,55%)]" />
                  Art & Environment Packs
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {assets.map((p) => renderProductCard(p, 'small'))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="rounded-xl p-6 text-center border border-[hsl(43,60%,30%)]/20 bg-[hsl(225,28%,12%)]">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(120,60%,50%,0.08)', border: '1px solid hsl(120,60%,50%,0.2)' }}>
              <Server className="h-6 w-6 text-emerald-400" />
            </div>
            <h4 className="font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>Self-Hosted</h4>
            <p className="text-sm text-[hsl(45,15%,55%)]">Deploy on your own Linux or Windows server — no vendor lock-in</p>
          </div>

          <div className="rounded-xl p-6 text-center border border-[hsl(43,60%,30%)]/20 bg-[hsl(225,28%,12%)]">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(43,85%,55%,0.08)', border: '1px solid hsl(43,60%,30%,0.2)' }}>
              <Shield className="h-6 w-6 text-[hsl(43,85%,55%)]" />
            </div>
            <h4 className="font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>Full Source Code</h4>
            <p className="text-sm text-[hsl(45,15%,55%)]">Every product comes with complete, unobfuscated source code you own</p>
          </div>

          <div className="rounded-xl p-6 text-center border border-[hsl(43,60%,30%)]/20 bg-[hsl(225,28%,12%)]">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(210,80%,50%,0.08)', border: '1px solid hsl(210,80%,50%,0.2)' }}>
              <Sparkles className="h-6 w-6 text-blue-400" />
            </div>
            <h4 className="font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>Lifetime Updates</h4>
            <p className="text-sm text-[hsl(45,15%,55%)]">Get every new game engine and feature update at no extra cost</p>
          </div>
        </div>

        <Card className="mt-12 border-[hsl(43,60%,30%)]/30 bg-[hsl(225,28%,12%)]">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-heading gold-text">Secure Payment Options</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl p-6 text-center border border-[hsl(43,60%,30%)]/20 bg-[hsl(225,30%,10%)]">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(210,80%,50%,0.1)', border: '1px solid hsl(210,80%,50%,0.3)' }}>
                  <Wallet className="h-7 w-7 text-blue-400" />
                </div>
                <h4 className="font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>PayPal</h4>
                <p className="text-sm text-[hsl(45,15%,55%)]">Secure payments via PayPal with buyer protection</p>
              </div>
              <div className="rounded-xl p-6 text-center border border-[hsl(43,60%,30%)]/20 bg-[hsl(225,30%,10%)]">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(43,85%,55%,0.1)', border: '1px solid hsl(43,60%,30%,0.3)' }}>
                  <Bitcoin className="h-7 w-7 text-[hsl(43,85%,55%)]" />
                </div>
                <h4 className="font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>Cryptocurrency</h4>
                <p className="text-sm text-[hsl(45,15%,55%)]">Bitcoin, Ethereum, and other major cryptocurrencies</p>
              </div>
              <div className="rounded-xl p-6 text-center border border-[hsl(43,60%,30%)]/20 bg-[hsl(225,30%,10%)]">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'hsl(120,60%,50%,0.1)', border: '1px solid hsl(120,60%,50%,0.3)' }}>
                  <CreditCard className="h-7 w-7 text-emerald-400" />
                </div>
                <h4 className="font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>Debit & Credit Cards</h4>
                <p className="text-sm text-[hsl(45,15%,55%)]">Visa, Mastercard, American Express accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedProduct && (
        <PaymentForm
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          price={selectedProduct.price}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </section>
  );
}
