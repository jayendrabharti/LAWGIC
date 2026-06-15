import { pdfjs } from "react-pdf";

// Ensure this only runs on the client to prevent Next.js SSR errors
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}
