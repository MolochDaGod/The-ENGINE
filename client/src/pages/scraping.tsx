import ScrapingTool from "@/components/scraping-tool";
import Footer from "@/components/footer";
import scrapingBg from "@assets/dcYwYe2_1773841540621.png";

export default function Scraping() {
  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(180deg, hsl(225,30%,6%), hsl(225,28%,10%))' }}>
      <div className="fixed inset-0 z-0 opacity-12 pointer-events-none" style={{ backgroundImage: `url(${scrapingBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[hsl(225,30%,6%)]/80 via-transparent to-[hsl(225,28%,10%)]/90 pointer-events-none" />
      <div className="relative z-10">
        <div className="py-12">
          <ScrapingTool />
        </div>
        <Footer />
      </div>
    </div>
  );
}
