"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Image from "next/image";
import {
  UploadIcon,
  FileIcon,
  LoaderIcon,
  XIcon,
  CheckIcon,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef, useCallback } from "react";
import ApiClient from "@/utils/ApiClient";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";

// Note: PDF.js worker is configured in PdfProvider.tsx to avoid conflicts

// Validation schema based on Document model
const documentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters"),
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, "Please select a file")
    .refine(
      (file) => file.type === "application/pdf",
      "Only PDF files are allowed",
    )
    .refine(
      (file) => file.size <= 50 * 1024 * 1024, // 50MB
      "File size must be less than 50MB",
    ),
});

type DocumentFormData = z.infer<typeof documentSchema>;

export default function AddDocument({
  onAdd,
  expanded,
}: {
  onAdd?: (docId?: string) => void;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<{
    pageCount: number;
    thumbnail: Blob | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      title: "",
    },
  });

  // Function to process PDF and extract thumbnail + page count
  const processPdf = useCallback(async (file: File) => {
    setIsProcessingPdf(true);
    try {
      const fileUrl = URL.createObjectURL(file);
      const { pdfjs } = await import("react-pdf");

      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      // Load PDF document
      const pdf = await pdfjs.getDocument(fileUrl).promise;
      const pageCount = pdf.numPages;

      // Get first page for thumbnail
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 }); // Scale down for thumbnail

      // Create canvas to render page
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Convert canvas to blob
        const thumbnailBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(
            (blob) => {
              resolve(blob!);
            },
            "image/png",
            0.8,
          );
        });

        setPdfInfo({
          pageCount,
          thumbnail: thumbnailBlob,
        });
      }

      // Clean up
      URL.revokeObjectURL(fileUrl);
    } catch (error) {
      console.error("Error processing PDF:", error);
      // toast.error("Failed to process PDF", {
      //   description: "Could not extract thumbnail and page count",
      // });
      setPdfInfo({ pageCount: 1, thumbnail: null });
    } finally {
      setIsProcessingPdf(false);
    }
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];

      if (file && file.type === "application/pdf") {
        form.setValue("file", file);
        // Auto-fill title if empty
        if (!form.getValues("title")) {
          const fileName = file.name.replace(/\.[^/.]+$/, "");
          form.setValue("title", fileName);
        }
        // Process PDF for thumbnail and page count
        await processPdf(file);
      }
    },
    [form, processPdf],
  );

  const handleFileSelect = useCallback(
    async (file: File) => {
      form.setValue("file", file);
      // Auto-fill title if empty
      if (!form.getValues("title")) {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        form.setValue("title", fileName);
      }
      // Process PDF for thumbnail and page count
      await processPdf(file);
    },
    [form, processPdf],
  );

  const removeFile = useCallback(() => {
    form.setValue("file", undefined as any);
    setPdfInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [form]);

  const onSubmit = async (data: DocumentFormData) => {
    try {
      setIsUploading(true);

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append("title", data.title);
      formData.append("file", data.file);

      // Add page count
      if (pdfInfo?.pageCount) {
        formData.append("pageCount", pdfInfo.pageCount.toString());
      }

      // Add thumbnail if available
      if (pdfInfo?.thumbnail) {
        formData.append("thumbnail", pdfInfo.thumbnail, "thumbnail.png");
      }

      // Send file to backend for S3 upload
      const response = await ApiClient.post("/documents", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        toast.success("Document uploaded successfully", {
          description: `"${data.title}" has been added to your documents`,
        });
        form.reset();
        setPdfInfo(null);
        setOpen(false);
        const newDocId = response.data.data.id;
        if (onAdd) onAdd(newDocId);
      } else {
        toast.error("Failed to save document", {
          description: response.data.error?.message || "Unknown error occurred",
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Failed to upload document", {
        description: error.response?.data?.error?.message || error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
      setPdfInfo(null);
      removeFile();
    }
    setOpen(isOpen);
  };
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button className="group relative w-full justify-start">
          <UploadIcon />
          <AnimatePresence>
            {expanded === true || expanded === undefined ? (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
              >
                Add Document
              </motion.span>
            ) : (
              <span className="bg-primary text-primary-foreground absolute left-full z-50 max-w-0 origin-left scale-x-0 transform overflow-hidden rounded-lg px-2 py-0.5 font-light opacity-0 transition-all duration-150 ease-in-out group-hover:max-w-xs group-hover:scale-x-100 group-hover:opacity-100">
                Add Document
              </span>
            )}
          </AnimatePresence>
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Upload Document</SheetTitle>
          <SheetDescription>
            Upload a PDF document to analyze and work with. The document will be
            securely stored and processed.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-6 space-y-6 p-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter document title..."
                      {...field}
                      disabled={isUploading}
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive title for your document
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>PDF File</FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileSelect(file);
                            onChange(file); // Update react-hook-form
                          }
                        }}
                        disabled={isUploading || isProcessingPdf}
                        className="sr-only"
                      />

                      {/* Custom upload area */}
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() =>
                          !isUploading &&
                          !isProcessingPdf &&
                          fileInputRef.current?.click()
                        }
                        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-all duration-200 ${
                          isDragOver
                            ? "border-primary bg-primary/5 scale-105"
                            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                        } ${isUploading || isProcessingPdf ? "cursor-not-allowed opacity-60" : ""} ${
                          value
                            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                            : ""
                        } `}
                      >
                        {!value ? (
                          <div className="space-y-4">
                            <div className="bg-primary/10 mx-auto flex h-12 w-12 items-center justify-center rounded-full">
                              <UploadIcon
                                className={`text-primary h-6 w-6 ${
                                  isDragOver ? "animate-bounce" : ""
                                }`}
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-lg font-medium">
                                {isDragOver
                                  ? "Drop your PDF here"
                                  : "Upload PDF Document"}
                              </p>
                              <p className="text-muted-foreground text-sm">
                                Drag and drop your file here, or click to browse
                              </p>
                              <p className="text-muted-foreground text-xs">
                                PDF files only • Max 50MB
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Thumbnail preview if available */}
                            {pdfInfo?.thumbnail && (
                              <div className="border-muted mx-auto h-32 w-24 overflow-hidden rounded-lg border shadow-sm">
                                <Image
                                  src={URL.createObjectURL(pdfInfo.thumbnail)}
                                  alt="PDF thumbnail"
                                  className="h-full w-full object-cover"
                                  width={96}
                                  height={128}
                                  onLoad={(e) => {
                                    // Clean up the object URL after the image loads
                                    const img = e.target as HTMLImageElement;
                                    setTimeout(() => {
                                      URL.revokeObjectURL(img.src);
                                    }, 1000);
                                  }}
                                />
                              </div>
                            )}

                            {/* Success indicator if no thumbnail */}
                            {!pdfInfo?.thumbnail && (
                              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                                <CheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                              </div>
                            )}

                            <div className="space-y-2">
                              <p className="text-lg font-medium text-green-700 dark:text-green-300">
                                File Selected
                              </p>
                              <div className="flex items-center justify-center gap-2 text-sm">
                                <FileIcon className="h-4 w-4" />
                                <span className="font-medium">
                                  {value.name}
                                </span>
                              </div>
                              <p className="text-muted-foreground text-xs">
                                {(value.size / 1024 / 1024).toFixed(2)} MB
                                {pdfInfo && ` • ${pdfInfo.pageCount} pages`}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile();
                                }}
                                disabled={isUploading || isProcessingPdf}
                                className="mt-2"
                              >
                                <XIcon className="mr-1 h-4 w-4" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* PDF Processing overlay */}
                        {isProcessingPdf && (
                          <div className="bg-background/80 absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-sm">
                            <div className="space-y-2 text-center">
                              <LoaderIcon className="text-primary mx-auto h-8 w-8 animate-spin" />
                              <p className="text-sm font-medium">
                                Processing PDF...
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Upload overlay */}
                        {isUploading && (
                          <div className="bg-background/80 absolute inset-0 flex items-center justify-center rounded-lg backdrop-blur-sm">
                            <div className="space-y-2 text-center">
                              <LoaderIcon className="text-primary mx-auto h-8 w-8 animate-spin" />
                              <p className="text-sm font-medium">
                                Uploading...
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Select a PDF file (max 50MB)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isUploading || isProcessingPdf}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUploading || isProcessingPdf || !pdfInfo}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : isProcessingPdf ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadIcon className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
