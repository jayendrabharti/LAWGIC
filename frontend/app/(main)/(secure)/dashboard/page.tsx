"use client";
import RevealHero from "@/components/animations/RevealHero";
import dynamic from "next/dynamic";

const AddDocument = dynamic(() => import("@/components/documents/AddDocument"), { 
  ssr: false 
});
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedState } from "@/hooks/useDebounce";
import useLocalState from "@/hooks/useLocalState";
import { cn } from "@/lib/utils";
import { useDocuments } from "@/providers/DocumentsProvider";
import {
  ExternalLinkIcon,
  LayoutGridIcon,
  ListIcon,
  LoaderCircleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EllipsisIcon,
  EditIcon,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { VscFilePdf } from "react-icons/vsc";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import RenameDocument from "@/components/documents/RenameDocument";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatTimestamp } from "@/utils/utils";
import Link from "next/link";
import DocumentMenu from "@/components/documents/DocumentMenu";

export default function DashboardPage() {
  const { loading, documents, error, refreshDocuments } = useDocuments();
  const router = useRouter();
  const [view, setView] = useLocalState<"list" | "grid">(
    "document-list-view",
    "list",
  );
  const [sort, setSort] = useLocalState<"createdAt" | "updatedAt" | "title">(
    "document-sort",
    "createdAt",
  );
  const [order, setOrder] = useLocalState<"asc" | "desc">(
    "document-order",
    "desc",
  );
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useDebouncedState<string>(
    "",
    300,
  );

  // Update debounced search when input changes
  useEffect(() => {
    setDebouncedSearch(searchInput);
  }, [searchInput, setDebouncedSearch]);

  const handleClick = (document: UserDocument) => {
    toast.info(document.title, { description: "Opening document..." });
    router.push(`/documents/${document.id}`);
  };

  const documentList = useMemo(() => {
    let filtered = documents;

    // Filter by search
    if (debouncedSearch.trim()) {
      const lower = debouncedSearch.trim().toLowerCase();
      filtered = filtered.filter(
        (doc) =>
          doc.title.toLowerCase().includes(lower) ||
          doc.fileName.toLowerCase().includes(lower),
      );
    }

    // Sort
    filtered = filtered.slice().sort((a, b) => {
      let aValue = a[sort];
      let bValue = b[sort];

      // If sorting by title, compare as strings
      if (sort === "title") {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
        if (aValue < bValue) return order === "asc" ? -1 : 1;
        if (aValue > bValue) return order === "asc" ? 1 : -1;
        return 0;
      }

      // For dates, compare as numbers
      const aTime = new Date(aValue).getTime();
      const bTime = new Date(bValue).getTime();
      return order === "asc" ? aTime - bTime : bTime - aTime;
    });

    return filtered;
  }, [documents, debouncedSearch, sort, order]);

  if (loading) {
    return (
      <section className="flex h-full w-full flex-1 flex-col items-center justify-center px-4">
        <p>Loading documents...</p>
        <LoaderCircleIcon className="mt-2 animate-spin" />
      </section>
    );
  }
  if (error) {
    return (
      <section className="flex w-full flex-1 flex-col px-4">
        <p>{error}</p>
      </section>
    );
  }

  const toggleView = () => {
    setView(view === "list" ? "grid" : "list");
  };

  return (
    <section className="flex w-full flex-1 flex-col gap-2 px-4">
      <div
        className={cn(
          "bg-background flex w-full flex-col gap-4 lg:flex-row lg:items-end",
          "border-border sticky top-0 z-50 border-b p-4",
        )}
      >
        <RevealHero className="text-xl font-bold md:text-3xl">
          Dashboard ({documents.length})
        </RevealHero>

        <div className="flex flex-col gap-4 lg:ml-auto lg:flex-row lg:items-end">
          {/* Search Input */}
          <div className="flex flex-col gap-1">
            <label className="text-muted-foreground text-sm font-medium">
              Search
            </label>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search documents..."
              className="w-full lg:w-64"
            />
          </div>

          {/* Sort Controls */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-sm font-medium">
                Sort by
              </label>
              <Select
                value={sort}
                onValueChange={(value: "createdAt" | "updatedAt" | "title") =>
                  setSort(value)
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt">Created</SelectItem>
                  <SelectItem value="updatedAt">Updated</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-sm font-medium">
                Order
              </label>
              <Button
                onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
                variant="outline"
                size="icon"
                title={`Sort ${order === "asc" ? "ascending" : "descending"}`}
              >
                {order === "asc" ? (
                  <ArrowUpIcon className="h-4 w-4" />
                ) : (
                  <ArrowDownIcon className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground text-sm font-medium">
                View
              </label>
              <Button
                onClick={toggleView}
                variant="outline"
                size="icon"
                title={`Switch to ${view === "list" ? "grid" : "list"} view`}
              >
                {view === "list" ? (
                  <ListIcon className="h-4 w-4" />
                ) : (
                  <LayoutGridIcon className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-muted-foreground invisible text-sm font-medium">
                Add
              </label>
              <AddDocument onAdd={refreshDocuments} />
            </div>
          </div>
        </div>
      </div>

      {documentList.length === 0 && (
        <p className="text-muted-foreground mx-auto text-sm">
          You have no documents. Start by uploading one or reset filter.
        </p>
      )}

      <div
        className={cn(
          "gap-4",
          view === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            : "flex flex-col gap-2",
        )}
      >
        {documentList.map((doc) => (
          // doc card / list item
          <div
            key={doc.id}
            onClick={() => handleClick(doc)}
            className={cn(
              "bg-muted border-border cursor-pointer rounded-2xl border p-4 shadow-md transition-all duration-200 hover:shadow-lg",
              view === "grid"
                ? "flex min-h-[200px] flex-col items-center justify-between gap-3 text-center"
                : "flex flex-col gap-4 md:flex-row md:items-center",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-4",
                view === "grid" ? "flex-col" : "flex-row",
              )}
            >
              <div
                className={cn(
                  "relative z-0 flex-shrink-0",
                  view === "grid"
                    ? "aspect-square w-full max-w-full flex-1"
                    : "h-16 w-12",
                )}
              >
                <Image
                  src={`${process.env.NEXT_PUBLIC_SERVER_URL}/documents/${doc.id}/thumbnail`}
                  alt="Document Thumbnail"
                  className="h-full w-full rounded-lg object-cover"
                  fill
                  onError={(e) => {
                    // Hide image and show PDF icon on error
                    const img = e.target as HTMLImageElement;
                    img.style.display = "none";
                    const fallback = img.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "block";
                  }}
                />
                <VscFilePdf
                  className={cn(
                    "text-primary absolute inset-0 flex h-full w-full items-center justify-center",
                    view === "grid" ? "text-4xl" : "text-2xl",
                    "hidden", // Hidden by default, shown on image error
                  )}
                  style={{ display: "none" }}
                />
              </div>
              <div className={cn(view === "grid" ? "text-center" : "")}>
                <h3
                  className={cn(
                    "font-semibold",
                    view === "grid"
                      ? "overflow-hidden text-sm text-ellipsis"
                      : "",
                  )}
                >
                  {doc.title}
                </h3>
                <table className="text-muted-foreground w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="pr-2 text-left font-medium">Filename:</td>
                      <td className="text-right break-all">{doc.fileName}</td>
                    </tr>
                    <tr>
                      <td className="pr-2 text-left font-medium">Pages:</td>
                      <td className="text-right">{doc.pageCount}</td>
                    </tr>
                    <tr>
                      <td className="pr-2 text-left font-medium">Updated:</td>
                      <td className="text-right">
                        {formatTimestamp(doc.updatedAt)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pr-2 text-left font-medium">Created:</td>
                      <td className="text-right">
                        {formatTimestamp(doc.createdAt)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div
              className={cn(
                "flex gap-2",
                view === "grid" ? "w-full" : "ml-auto",
              )}
            >
              <DocumentMenu
                className={view === "grid" ? "w-full" : ""}
                doc={doc}
                refreshDocuments={refreshDocuments}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
