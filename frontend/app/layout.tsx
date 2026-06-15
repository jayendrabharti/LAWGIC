import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DataProvider } from "@/providers/DataProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import SessionProvider from "@/providers/SessionProvider";
import { DocumentsProvider } from "@/providers/DocumentsProvider";
import DynamicFavicon from "@/components/DynamicFavicon";

export const metadata: Metadata = {
  title: "LAWGIC",
  description: "Legal Document Assitant",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full overflow-hidden">
      <body className={cn("flex h-full w-full flex-col overflow-hidden")}>
        <SessionProvider>
          <DataProvider>
            <ThemeProvider>
              <DocumentsProvider>
                <DynamicFavicon/>
                {children}
                <Toaster richColors />
              </DocumentsProvider>
            </ThemeProvider>
          </DataProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

