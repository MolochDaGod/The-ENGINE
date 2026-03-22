import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Globe, Worm, Eye, Download, CheckCircle, Clock, AlertCircle } from "lucide-react";
import type { ScrapingJob } from "@shared/schema";

export default function ScrapingTool() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("10");
  const [crawlDepth, setCrawlDepth] = useState("1");
  const [outputFormat, setOutputFormat] = useState("json");
  const { toast } = useToast();

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<ScrapingJob[]>({
    queryKey: ["/api/scraping/jobs"],
    refetchInterval: 2000,
  });

  const startScrapingMutation = useMutation({
    mutationFn: async (data: { url: string; maxPages: number; crawlDepth: number; outputFormat: string }) => {
      const response = await apiRequest("POST", "/api/scraping/start", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Scraping Started",
        description: "Your scraping job has been queued and will begin shortly.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scraping/jobs"] });
      setUrl("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    startScrapingMutation.mutate({
      url,
      maxPages: parseInt(maxPages),
      crawlDepth: parseInt(crawlDepth),
      outputFormat,
    });
  };

  const handleDownload = async (jobId: number, format: string) => {
    try {
      const response = await fetch(`/api/scraping/jobs/${jobId}/download?format=${format}`);
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const dlUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = dlUrl;
      a.download = `scraped_data_${jobId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(dlUrl);
      document.body.removeChild(a);
      
      toast({
        title: "Download Started",
        description: "Your scraped data is being downloaded.",
      });
    } catch {
      toast({
        title: "Download Error",
        description: "Failed to download scraped data.",
        variant: "destructive",
      });
    }
  };

  const activeJob = jobs.find(job => job.status === "running");
  const completedJobs = jobs.filter(job => job.status === "completed");

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-heading gold-text font-bold mb-4">Web Scraping Tool</h2>
          <p className="text-lg text-[hsl(45,15%,55%)] font-body">
            Enter any website URL and extract content automatically
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="mb-8 border-[hsl(43,60%,30%)]/30 bg-[hsl(225,28%,12%)]">
            <CardHeader>
              <CardTitle className="font-heading text-[hsl(45,30%,90%)]" style={{ WebkitTextFillColor: 'unset' }}>Start New Scraping Job</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label className="text-[hsl(45,15%,60%)]">Website URL</Label>
                  <div className="relative mt-2">
                    <Input
                      type="url"
                      placeholder="https://example.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="pl-10 bg-[hsl(225,30%,8%)] border-[hsl(43,60%,30%)]/30 text-[hsl(45,30%,90%)] placeholder:text-[hsl(45,15%,35%)]"
                      required
                    />
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsl(45,15%,40%)] h-4 w-4" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-[hsl(45,15%,60%)]">Max Pages</Label>
                    <Select value={maxPages} onValueChange={setMaxPages}>
                      <SelectTrigger className="mt-2 bg-[hsl(225,30%,8%)] border-[hsl(43,60%,30%)]/30 text-[hsl(45,30%,90%)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 pages</SelectItem>
                        <SelectItem value="50">50 pages</SelectItem>
                        <SelectItem value="100">100 pages</SelectItem>
                        <SelectItem value="1000">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[hsl(45,15%,60%)]">Crawl Depth</Label>
                    <Select value={crawlDepth} onValueChange={setCrawlDepth}>
                      <SelectTrigger className="mt-2 bg-[hsl(225,30%,8%)] border-[hsl(43,60%,30%)]/30 text-[hsl(45,30%,90%)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Level 1</SelectItem>
                        <SelectItem value="2">Level 2</SelectItem>
                        <SelectItem value="3">Level 3</SelectItem>
                        <SelectItem value="10">All levels</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-[hsl(45,15%,60%)]">Output Format</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger className="mt-2 bg-[hsl(225,30%,8%)] border-[hsl(43,60%,30%)]/30 text-[hsl(45,30%,90%)]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="html">HTML</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button 
                    type="submit" 
                    className="gilded-button"
                    disabled={startScrapingMutation.isPending}
                  >
                    <Worm className="mr-2 h-4 w-4" />
                    {startScrapingMutation.isPending ? "Starting..." : "Start Scraping"}
                  </Button>
                  <Button type="button" variant="outline" className="border-[hsl(43,60%,30%)]/40 text-[hsl(45,30%,90%)] hover:bg-[hsl(225,25%,15%)]">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview Site
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {activeJob && (
            <Card className="mb-8 border-[hsl(43,60%,30%)]/30 bg-[hsl(225,28%,12%)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-heading text-[hsl(45,30%,90%)]" style={{ WebkitTextFillColor: 'unset' }}>
                  <Clock className="h-5 w-5 text-[hsl(43,85%,55%)]" />
                  Scraping Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm text-[hsl(45,15%,55%)] mb-2">
                    <span>Overall Progress</span>
                    <span>{activeJob.progress}%</span>
                  </div>
                  <Progress value={activeJob.progress} className="w-full" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-[hsl(43,85%,55%)]">{activeJob.pagesFound}</div>
                    <div className="text-sm text-[hsl(45,15%,55%)]">Pages Found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-400">{activeJob.pagesScraped}</div>
                    <div className="text-sm text-[hsl(45,15%,55%)]">Pages Scraped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-400">
                      {Math.max(0, (activeJob.maxPages || 10) - activeJob.pagesScraped)}
                    </div>
                    <div className="text-sm text-[hsl(45,15%,55%)]">Remaining</div>
                  </div>
                </div>

                <div className="rounded-lg p-4 bg-[hsl(225,30%,8%)] border border-[hsl(43,60%,30%)]/20">
                  <h4 className="font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>Current Job</h4>
                  <div className="space-y-1 text-sm text-[hsl(45,15%,55%)]">
                    <div>Scraping: {activeJob.url}</div>
                    <div>Status: {activeJob.status}</div>
                    <div>Format: {activeJob.outputFormat}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {completedJobs.length > 0 && (
            <Card className="border-[hsl(43,60%,30%)]/30 bg-[hsl(225,28%,12%)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-heading text-[hsl(45,30%,90%)]" style={{ WebkitTextFillColor: 'unset' }}>
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  Completed Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {completedJobs.slice(0, 5).map((job) => (
                    <div key={job.id} className="border border-[hsl(43,60%,30%)]/20 rounded-lg p-4 bg-[hsl(225,30%,8%)]">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-[hsl(45,30%,90%)]">{job.url}</h4>
                          <div className="flex items-center gap-4 text-sm text-[hsl(45,15%,55%)]">
                            <span>{job.pagesScraped} pages scraped</span>
                            <Badge className="bg-[hsl(43,85%,55%)]/20 text-[hsl(43,85%,55%)]">{job.outputFormat}</Badge>
                            <span>{new Date(job.completedAt!).toLocaleString()}</span>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[hsl(43,60%,30%)]/40 text-[hsl(43,85%,55%)] hover:bg-[hsl(43,85%,55%)]/10"
                          onClick={() => handleDownload(job.id, job.outputFormat || "json")}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                      
                      {job.error && (
                        <div className="mt-2 p-2 bg-red-900/20 border border-red-500/30 rounded text-sm text-red-300">
                          <AlertCircle className="inline mr-1 h-4 w-4" />
                          {job.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!activeJob && completedJobs.length === 0 && !jobsLoading && (
            <Card className="border-[hsl(43,60%,30%)]/30 bg-[hsl(225,28%,12%)]">
              <CardContent className="text-center py-12">
                <Worm className="mx-auto h-12 w-12 text-[hsl(45,15%,40%)] mb-4" />
                <h3 className="text-lg font-heading text-[hsl(45,30%,90%)] mb-2" style={{ WebkitTextFillColor: 'unset' }}>No scraping jobs yet</h3>
                <p className="text-[hsl(45,15%,55%)]">Enter a URL above to start your first scraping job.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
