import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Wallet, Bitcoin, CheckCircle, Gamepad2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PaymentFormProps {
  productId: number;
  productName: string;
  price: number;
  onClose: () => void;
}

export default function PaymentForm({ productId, productName, price, onClose }: PaymentFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal" | "crypto" | "gbux">("card");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState("");
  const { toast } = useToast();

  const formatPrice = (price: number) => {
    return (price / 100).toFixed(2);
  };

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: { 
      customerEmail: string; 
      customerName?: string;
      productId: number; 
      amount: number;
      paymentMethod: string;
    }) => {
      const response = await apiRequest("POST", "/api/store/orders", orderData);
      return response.json();
    },
    onSuccess: (order) => {
      toast({
        title: "Payment Successful!",
        description: `Your purchase of ${productName} has been completed. Order ID: ${order.id}`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Payment Failed",
        description: error.message || "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePayment = async () => {
    if (!customerEmail) {
      toast({
        title: "Email Required",
        description: "Please enter your email address to complete the purchase.",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "crypto" && !cryptoCurrency) {
      toast({
        title: "Cryptocurrency Required",
        description: "Please select a cryptocurrency for payment.",
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === "gbux") {
      const res = await fetch("/api/gbux/purchase-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Purchase Failed", description: data.error || "GBUX purchase failed.", variant: "destructive" });
      } else {
        toast({ title: "Purchase Complete!", description: `${productName} unlocked. Balance: ${data.newBalance} GBUX` });
        onClose();
      }
      return;
    }

    createOrderMutation.mutate({
      customerEmail,
      customerName: customerName || undefined,
      productId,
      amount: price,
      paymentMethod,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Purchase {productName}
            <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
          </CardTitle>
          <p className="text-lg font-semibold">${formatPrice(price)}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Payment Method Selection */}
          <div>
            <Label>Payment Method</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentMethod("card")}
                className="flex items-center gap-1"
              >
                <CreditCard size={16} />
                Card
              </Button>
              <Button
                variant={paymentMethod === "paypal" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentMethod("paypal")}
                className="flex items-center gap-1"
              >
                <Wallet size={16} />
                PayPal
              </Button>
              <Button
                variant={paymentMethod === "crypto" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentMethod("crypto")}
                className="flex items-center gap-1"
              >
                <Bitcoin size={16} />
                Crypto
              </Button>
              <Button
                variant={paymentMethod === "gbux" ? "default" : "outline"}
                size="sm"
                onClick={() => setPaymentMethod("gbux")}
                className="flex items-center gap-1"
                style={paymentMethod === "gbux" ? { background: 'rgba(74,222,128,0.2)', borderColor: '#4ade80', color: '#4ade80' } : undefined}
              >
                <Gamepad2 size={16} />
                GBUX
              </Button>
            </div>
          </div>

          <Separator />

          {/* Customer Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="customerEmail">Email Address *</Label>
              <Input
                id="customerEmail"
                placeholder="your@email.com"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="customerName">Full Name</Label>
              <Input
                id="customerName"
                placeholder="John Doe"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
          </div>

          <Separator />

          {/* Card Payment Form */}
          {paymentMethod === "card" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  type="text"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiry">Expiry Date</Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    type="text"
                  />
                </div>
                <div>
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    placeholder="123"
                    type="text"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PayPal Payment */}
          {paymentMethod === "paypal" && (
            <div className="text-center space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  You will be redirected to PayPal to complete your payment securely.
                </p>
              </div>
            </div>
          )}

          {/* Cryptocurrency Payment */}
          {paymentMethod === "crypto" && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="cryptoType">Cryptocurrency</Label>
                <Select value={cryptoCurrency} onValueChange={setCryptoCurrency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cryptocurrency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bitcoin">Bitcoin (BTC)</SelectItem>
                    <SelectItem value="ethereum">Ethereum (ETH)</SelectItem>
                    <SelectItem value="litecoin">Litecoin (LTC)</SelectItem>
                    <SelectItem value="dogecoin">Dogecoin (DOGE)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  Cryptocurrency payments are processed through our secure blockchain gateway.
                  Transaction confirmations may take 5-30 minutes.
                </p>
              </div>
            </div>
          )}

          {/* GBUX Payment */}
          {paymentMethod === "gbux" && (
            <div className="rounded-lg p-4 space-y-2" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
              <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>Pay with GBUX</p>
              <p className="text-xs text-muted-foreground">
                GBUX is the Grudge Studio in-game currency. You must be logged in to spend GBUX.
                No email or card info needed — the purchase is instant.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handlePayment}
            disabled={createOrderMutation.isPending}
            className="w-full"
            size="lg"
            style={paymentMethod === "gbux" ? { background: 'rgba(74,222,128,0.2)', borderColor: '#4ade80', color: '#4ade80' } : undefined}
          >
            {createOrderMutation.isPending ? "Processing..." : paymentMethod === "gbux" ? "Pay with GBUX" : `Pay $${formatPrice(price)}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}