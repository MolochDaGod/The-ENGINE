import { apiRequest } from "./queryClient";
import type { ScrapingJob, StoreProduct, Order } from "@shared/schema";

export const scrapingApi = {
  startJob: async (data: {
    url: string;
    maxPages: number;
    crawlDepth: number;
    outputFormat: string;
  }): Promise<ScrapingJob> => {
    const response = await apiRequest("POST", "/api/scraping/start", data);
    return response.json();
  },

  getJobs: async (): Promise<ScrapingJob[]> => {
    const response = await apiRequest("GET", "/api/scraping/jobs");
    return response.json();
  },

  getJob: async (id: number): Promise<ScrapingJob> => {
    const response = await apiRequest("GET", `/api/scraping/jobs/${id}`);
    return response.json();
  },

  downloadJob: async (id: number, format: string): Promise<Blob> => {
    const response = await apiRequest("GET", `/api/scraping/jobs/${id}/download?format=${format}`);
    return response.blob();
  },
};

export const storeApi = {
  getProducts: async (): Promise<StoreProduct[]> => {
    const response = await apiRequest("GET", "/api/store/products");
    return response.json();
  },

  getProduct: async (id: number): Promise<StoreProduct> => {
    const response = await apiRequest("GET", `/api/store/products/${id}`);
    return response.json();
  },

  createOrder: async (data: {
    customerEmail: string;
    productId: number;
    amount: number;
    paymentMethod: string;
    paymentStatus: string;
  }): Promise<Order> => {
    const response = await apiRequest("POST", "/api/store/orders", data);
    return response.json();
  },

  getOrders: async (): Promise<Order[]> => {
    const response = await apiRequest("GET", "/api/store/orders");
    return response.json();
  },
};
