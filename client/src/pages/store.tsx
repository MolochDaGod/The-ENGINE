import StoreSection from "@/components/store-section";
import Footer from "@/components/footer";
import storeBg from "@assets/jbIotta_1773841520595.png";

export default function Store() {
  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))' }}>
      <div className="fixed inset-0 z-0 opacity-15 pointer-events-none" style={{ backgroundImage: `url(${storeBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/80 via-transparent to-[hsl(225,28%,10%)]/90 pointer-events-none" />
      <div className="relative z-10">
        <div className="py-12">
          <StoreSection />
        </div>
        <Footer />
      </div>
    </div>
  );
}
