import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  SearchIcon,
  AlertTriangleIcon,
  ShieldAlertIcon,
  AlertCircleIcon,
  InfoIcon,
  EyeIcon,
  ScanIcon,
  DownloadIcon,
} from "lucide-react";
import { THREAT_COLORS, Highlight, HighlightColor } from "./types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { usePDF } from "../PdfProvider";
import { generateThreatsPDF } from "@/utils/pdfThreatGenerator";
import ApiClient from "@/utils/ApiClient";

/**
 * PdfThreats Component
 *
 * Renders a sidebar panel for PDF threat detection with the following features:
 * - Extracts PDF text using Selection API
 * - Sends page-wise content to backend for analysis
 * - Converts threat responses to Highlight objects
 * - Stores threats as highlights in localStorage
 * - Displays threats with severity-based filtering
 *
 * @component
 * @returns {JSX.Element} The PDF threats panel
 */
export default function PdfThreats() {
  // ========================================
  // CONTEXT & STATE
  // ========================================

  const {
    pdfUrl,
    documentId,
    numPages,
    textLayerRef,
    pagesRefs,
    jumpToHighlight,
    setStoredThreats,
    addThreatToStorage,
    threats,
    isAnalyzing,
    generateThreatsAnalysis,
  } = usePDF();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState({
    current: 0,
    total: 0,
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [backendThreats, setBackendThreats] = useState<any[]>([]);
  const [threatHighlights, setThreatHighlights] = useState<Highlight[]>([]);
  const [threatsExist, setThreatsExist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ========================================
  // EFFECTS
  // ========================================

  // Sync provider threats data with local state
  useEffect(() => {
    if (threats && threats.totalThreats > 0) {
      // Provider has threats data, sync with local state
      setThreatsExist(true);
      setIsLoading(false);

      // Convert threat analysis result to local format if needed
      console.log('🔍 THREATS: Raw threats data from backend:', threats);
      console.log('🔍 THREATS: threats.pages:', threats.pages);
      
      const threatList = threats.pages.flatMap((page, pageIndex) => {
        console.log(`🔍 THREATS: Processing page ${page.page} (index ${pageIndex}) with ${page.threats.length} threats`);
        console.log(`🔍 THREATS: Page object:`, page);
        console.log(`🔍 THREATS: page.page value:`, page.page, 'type:', typeof page.page, 'truthy:', !!page.page);
        
        // Guard against missing page numbers
        const actualPageNumber = page.page || (pageIndex + 1);
        if (!page.page) {
          console.warn(`⚠️ THREATS: page.page is missing! Using fallback: ${actualPageNumber}`);
        }
        
        return page.threats.map((threat: any) => {
          console.log(`🔍 THREATS: Before assignment - threat object:`, threat);
          console.log(`🔍 THREATS: Before assignment - threat.page:`, threat.page);
          console.log(`🔍 THREATS: actualPageNumber being assigned:`, actualPageNumber);
          
          const threatWithPage = {
            ...threat,
            page: actualPageNumber,
            // Ensure we preserve any existing page number if it's valid
            ...(threat.page && threat.page > 0 ? { page: threat.page } : {}),
          };
          
          // Final verification - use the highest priority page number
          const finalPageNumber = threatWithPage.page || actualPageNumber;
          if (finalPageNumber !== threatWithPage.page) {
            threatWithPage.page = finalPageNumber;
            console.log(`🔧 THREATS: Corrected page number to: ${finalPageNumber}`);
          }
          
          console.log(`🔍 THREATS: After assignment - threatWithPage:`, threatWithPage);
          console.log(`🔍 THREATS: After assignment - threatWithPage.page:`, threatWithPage.page);
          
          // Verify the assignment worked
          if (threatWithPage.page !== finalPageNumber) {
            console.error(`❌ THREATS: Page assignment failed! Expected ${finalPageNumber}, got ${threatWithPage.page}`);
          } else {
            console.log(`✅ THREATS: Page assignment successful: ${threatWithPage.page}`);
          }
          
          return threatWithPage;
        });
      });

      console.log('🔍 THREATS: Final threat list:', threatList);
      setBackendThreats(threatList);

      // Check if PDF is ready for position calculation
      const pagesReady = pagesRefs?.current?.size > 0 && textLayerRef?.current;
      console.log(`🔍 THREATS: PDF readiness check - pagesRefs size: ${pagesRefs?.current?.size}, textLayerRef: ${!!textLayerRef?.current}`);
      
      if (!pagesReady) {
        console.warn('⚠️ THREATS: PDF not fully loaded yet, delaying threat position calculation');
        // Set a delayed retry
        setTimeout(() => {
          console.log('🔄 THREATS: Retrying threat position calculation after PDF load');
          // Re-trigger the useEffect by updating a dependency
          const retryHighlights = threatList.map((threat: any) => convertBackendThreatToHighlight(threat));
          setThreatHighlights(retryHighlights);
          setStoredThreats(retryHighlights);
        }, 1000);
        return;
      }

      // Convert to highlight format for display
      console.log('🔍 THREATS: Converting to highlight format...');
      const highlights = threatList.map((threat: any, index: number) => {
        console.log(`🔍 THREATS: Converting threat ${index + 1}/${threatList.length}:`, threat);
        const highlight = convertBackendThreatToHighlight(threat);
        console.log(`🔍 THREATS: Converted to highlight:`, highlight);
        return highlight;
      });
      
      console.log('🔍 THREATS: All highlights created:', highlights);
      setThreatHighlights(highlights);

      // Also sync to provider's storedThreats for the highlighting system
      setStoredThreats(highlights);
    } else {
      // No threats from provider
      setThreatsExist(false);
      setIsLoading(false);
      setBackendThreats([]);
      setThreatHighlights([]);
      setStoredThreats([]); // Clear stored threats as well
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threats]); // convertBackendThreatToHighlight is stable within component lifecycle

  // Calculate positions for threats that need it when text layer becomes available
  useEffect(() => {
    const calculateMissingPositions = async () => {
      if (!textLayerRef.current || threatHighlights.length === 0) {
        return;
      }

      const threatsNeedingPosition = threatHighlights.filter(
        (highlight) => highlight.metadata.needsPositionCalculation
      );

      if (threatsNeedingPosition.length === 0) {
        return;
      }

      console.log(`🔍 THREATS: Calculating positions for ${threatsNeedingPosition.length} threats`);

      // Process threats sequentially to avoid overwhelming the UI
      for (const highlight of threatsNeedingPosition) {
        try {
          console.log(`🔍 THREATS: Processing threat ${highlight.id} - page: ${highlight.position.pageNumber}, needsCalc: ${highlight.metadata.needsPositionCalculation}`);
          
          const calculatedHighlight = await calculateThreatPosition(highlight);
          
          if (calculatedHighlight && !calculatedHighlight.metadata.needsPositionCalculation) {
            console.log(`✅ THREATS: Successfully calculated position for threat ${highlight.id}`);
            
            // Update this specific highlight in local state
            setThreatHighlights(prev => 
              prev.map(h => h.id === highlight.id ? calculatedHighlight : h)
            );

            // IMPORTANT: Also update the provider's storedThreats so highlighting system can use it
            setStoredThreats(prev => {
              const existingIndex = prev.findIndex(t => t.id === highlight.id);
              if (existingIndex !== -1) {
                // Update existing threat
                const updated = [...prev];
                updated[existingIndex] = calculatedHighlight;
                return updated;
              } else {
                // Add new threat if not exists
                return [...prev, calculatedHighlight];
              }
            });

            // Cache the position back to the database
            cachePositionToDatabase(calculatedHighlight);
          }
        } catch (error) {
          console.error(`🔍 THREATS: Error calculating position for threat ${highlight.id}:`, error);
        }

        // Small delay to avoid blocking the UI
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('✅ THREATS: Position calculations completed');
    };

    // Only run if we have threats that need position calculation
    const needsCalculation = threatHighlights.some(h => h.metadata.needsPositionCalculation);
    if (needsCalculation && textLayerRef.current) {
      // Run calculation after a short delay to ensure text layer is fully rendered
      const timeoutId = setTimeout(calculateMissingPositions, 300);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threatHighlights]); // Only depend on threatHighlights - other deps are stable

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  /**
   * Convert backend threat data to frontend highlight format
   * Now calculates actual positions using text-finding logic
   */
  const convertBackendThreatToHighlight = (threat: any): Highlight => {
    const pageNumber = threat.page || threat.pageNumber || threat.position?.pageNumber || 1;
    const text = threat.exactStringThreat || threat.text || "";

    return {
      id: threat.id || `threat-${pageNumber}-${text.slice(0, 24)}`,
      text,
      position: {
        startOffset: 0,
        endOffset: text.length,
        pageNumber,
        startPageOffset: 0,
        endPageOffset: text.length,
      },
      color: getThreatColor(threat.severity),
      metadata: {
        id: threat.id || `threat-${pageNumber}-${text.slice(0, 24)}`,
        text,
        note: threat.explanation || threat.reason || "",
        tags: ["threat", threat.severity?.toLowerCase() || "high"],
        createdAt: new Date().toISOString(),
        author: "threat-analyzer",
        needsPositionCalculation: false,
        threatSeverity: threat.severity,
        threatType: "detected",
        explanation: threat.explanation || threat.reason || "",
      },
      isActive: false,
      isTemporary: false,
    };
  };

  /**
   * Calculate position for a threat highlight using text-finding logic
   */
  const calculateThreatPosition = async (highlight: Highlight): Promise<Highlight | null> => {
    console.log(`🔍 THREATS: Starting position calculation for threat ${highlight.id}`);
    console.log(`🔍 THREATS: Current highlight position:`, highlight.position);
    console.log(`🔍 THREATS: Threat text: "${highlight.text}"`);
    console.log(`🔍 THREATS: Metadata:`, highlight.metadata);
    
    if (!textLayerRef.current) {
      console.warn('🔍 THREATS: Text layer not available for position calculation');
      return highlight;
    }

    const pageNumber = highlight.position.pageNumber;
    const threatText = highlight.text;

    // CRITICAL: Validate page number
    console.log(`🔍 THREATS: Page number from highlight: ${pageNumber} (type: ${typeof pageNumber})`);
    if (!pageNumber || pageNumber < 1) {
      console.error(`❌ THREATS: Invalid page number! pageNumber: ${pageNumber}`);
      console.log('🔍 THREATS: Full highlight object:', JSON.stringify(highlight, null, 2));
      return highlight;
    }

    console.log(`🔍 THREATS: Calculating position for threat on page ${pageNumber}: "${threatText.substring(0, 50)}..."`);

    // Debug pagesRefs state before lookup
    console.log('🔍 THREATS: pagesRefs debug info:', {
      exists: !!pagesRefs?.current,
      size: pagesRefs?.current?.size || 0,
      keys: Array.from(pagesRefs?.current?.keys() || []),
      hasPageNumber: pagesRefs?.current?.has(pageNumber),
      requestedPageNumber: pageNumber,
      pageNumberType: typeof pageNumber
    });

    // Find the page element using pagesRefs (same as PdfProvider does)
    const pageElement = pagesRefs?.current?.get(pageNumber);
    
    if (!pageElement) {
      console.error(`❌ THREATS: Page ${pageNumber} element not found in pagesRefs`);
      console.log('🔍 THREATS: Available pages in pagesRefs:', Array.from(pagesRefs?.current?.keys() || []));
      console.log('🔍 THREATS: pagesRefs.current exists:', !!pagesRefs?.current);
      
      // Fallback: try to find by React PDF structure
      if (!textLayerRef?.current) {
        console.error('❌ THREATS: textLayerRef also not available, cannot proceed');
        return highlight;
      }
      
      const allPages = textLayerRef.current.querySelectorAll('.react-pdf__Page');
      const targetPage = Array.from(allPages)[pageNumber - 1]; // 0-indexed
      
      if (!targetPage) {
        console.warn(`🔍 THREATS: Page ${pageNumber} not found via fallback method either (total pages: ${allPages.length})`);
        return highlight;
      }
      
      console.log(`✅ THREATS: Using fallback method for page ${pageNumber}`);
      return await calculatePositionFromPageElement(targetPage, highlight, threatText);
    }

    return await calculatePositionFromPageElement(pageElement, highlight, threatText);
  };

  /**
   * Helper function to calculate position from a specific page element
   */
  const calculatePositionFromPageElement = async (
    pageElement: Element, 
    highlight: Highlight, 
    threatText: string
  ): Promise<Highlight> => {
    // Find the text content layer within this page
    const textLayer = pageElement.querySelector(".react-pdf__Page__textContent");
    
    if (!textLayer) {
      console.warn(`🔍 THREATS: Text layer not found within page element`);
      return highlight;
    }

    console.log(`🔍 THREATS: Found text layer, attempting to locate text: "${threatText.substring(0, 30)}..."`);

    // Try multiple approaches to find the threat text
    let success = false;
    
    // Approach 1: Direct word-by-word search
    success = selectTextWordByWord(textLayer, threatText);
    
    // Approach 2: Fallback - search for normalized text
    if (!success) {
      console.log('🔍 THREATS: Word-by-word search failed, trying normalized search...');
      success = selectTextDirectly(textLayer, threatText);
    }
    
    // Approach 3: Last resort - partial text search
    if (!success && threatText.length > 20) {
      console.log('🔍 THREATS: Direct search failed, trying partial text search...');
      const partialText = threatText.substring(0, Math.min(threatText.length, 30)).trim();
      success = selectTextDirectly(textLayer, partialText);
    }

    if (success) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Calculate PAGE-RELATIVE offsets first
        const pageStartOffset = getTextOffsetInPage(
          textLayer,
          range.startContainer,
          range.startOffset,
        );
        const pageEndOffset = getTextOffsetInPage(
          textLayer,
          range.endContainer,
          range.endOffset,
        );

        // Convert to DOCUMENT-WIDE offsets for the highlighting system
        const documentStartOffset = convertPageOffsetToDocumentOffset(
          highlight.position.pageNumber,
          pageStartOffset
        );
        const documentEndOffset = convertPageOffsetToDocumentOffset(
          highlight.position.pageNumber,
          pageEndOffset
        );

        console.log(
          `✅ THREATS: Position calculated - page ${highlight.position.pageNumber}, page-relative: ${pageStartOffset}-${pageEndOffset}, document-wide: ${documentStartOffset}-${documentEndOffset}`,
        );
        
        // Debug: Verify the calculated offsets match the highlighting system expectations
        if (textLayerRef.current) {
          const textLayerFullText = textLayerRef.current.textContent || "";
          const extractedText = textLayerFullText.slice(documentStartOffset, documentEndOffset);
          console.log(`🔍 THREATS: Verification - total document text length: ${textLayerFullText.length}`);
          console.log(`🔍 THREATS: Verification - extracted text from calculated offsets: "${extractedText}"`);
          console.log(`🔍 THREATS: Verification - threat text: "${threatText}"`);
          console.log(`🔍 THREATS: Verification - matches threat text: ${extractedText === threatText}`);
          
          if (extractedText !== threatText) {
            console.error(`❌ THREATS: OFFSET MISMATCH! Expected "${threatText}" but got "${extractedText}"`);
          }
        }

        // Create updated highlight with calculated position
        const updatedHighlight: Highlight = {
          ...highlight,
          position: {
            pageNumber: highlight.position.pageNumber,
            startOffset: documentStartOffset, // Use document-wide for highlighting system
            endOffset: documentEndOffset,     // Use document-wide for highlighting system
            startPageOffset: pageStartOffset,  // Keep page-relative for reference
            endPageOffset: pageEndOffset,      // Keep page-relative for reference
          },
          metadata: {
            ...highlight.metadata,
            needsPositionCalculation: false,
          },
        };

        // Clear selection
        selection.removeAllRanges();

        return updatedHighlight;
      }
    }

    // If exact match failed, try a more flexible approach
    console.log(`🔍 THREATS: Exact match failed, trying fuzzy text search...`);
    const success2 = await tryFuzzyTextMatch(textLayer, threatText, highlight);
    if (success2) {
      return success2;
    }

    console.warn(`❌ THREATS: Could not calculate position for threat: "${threatText.substring(0, 50)}..."`);
    return highlight;
  };

  /**
   * Fallback fuzzy text matching for difficult cases
   */
  const tryFuzzyTextMatch = async (
    textLayer: Element, 
    threatText: string, 
    highlight: Highlight
  ): Promise<Highlight | null> => {
    try {
      // Get all text content from the page
      const pageText = textLayer.textContent || '';
      const normalizedPageText = pageText.toLowerCase().replace(/\s+/g, ' ').trim();
      const normalizedThreatText = threatText.toLowerCase().replace(/\s+/g, ' ').trim();
      
      // Try to find the text with some flexibility
      const index = normalizedPageText.indexOf(normalizedThreatText);
      
      if (index !== -1) {
        console.log(`🔍 THREATS: Found text via fuzzy matching at page-relative index ${index}`);
        
        // Convert page-relative offsets to document-wide offsets
        const documentStartOffset = convertPageOffsetToDocumentOffset(
          highlight.position.pageNumber,
          index
        );
        const documentEndOffset = convertPageOffsetToDocumentOffset(
          highlight.position.pageNumber,
          index + threatText.length
        );
        
        // For fuzzy matches, create a basic position estimate
        const updatedHighlight: Highlight = {
          ...highlight,
          position: {
            pageNumber: highlight.position.pageNumber,
            startOffset: documentStartOffset,
            endOffset: documentEndOffset,
            startPageOffset: index,
            endPageOffset: index + threatText.length,
          },
          metadata: {
            ...highlight.metadata,
            needsPositionCalculation: false,
            matchType: 'fuzzy',
          },
        };
        
        return updatedHighlight;
      }
      
      // Try partial matching with first few words
      const words = normalizedThreatText.split(' ').slice(0, 5); // First 5 words
      for (const word of words) {
        if (word.length > 3) { // Only meaningful words
          const wordIndex = normalizedPageText.indexOf(word);
          if (wordIndex !== -1) {
            console.log(`🔍 THREATS: Found partial match with word "${word}" at page-relative index ${wordIndex}`);
            
            // Convert page-relative offsets to document-wide offsets
            const documentStartOffset = convertPageOffsetToDocumentOffset(
              highlight.position.pageNumber,
              wordIndex
            );
            const documentEndOffset = convertPageOffsetToDocumentOffset(
              highlight.position.pageNumber,
              wordIndex + threatText.length
            );
            
            const updatedHighlight: Highlight = {
              ...highlight,
              position: {
                pageNumber: highlight.position.pageNumber,
                startOffset: documentStartOffset,
                endOffset: documentEndOffset,
                startPageOffset: wordIndex,
                endPageOffset: wordIndex + threatText.length,
              },
              metadata: {
                ...highlight.metadata,
                needsPositionCalculation: false,
                matchType: 'partial',
              },
            };
            
            return updatedHighlight;
          }
        }
      }
      
    } catch (error) {
      console.error('🔍 THREATS: Error in fuzzy text matching:', error);
    }
    
    return null;
  };

  /**
   * Cache calculated position back to the database
   */
  const cachePositionToDatabase = async (highlight: Highlight) => {
    try {
      // Here you would make an API call to update the threat's position in the database
      // For now, just log it
      console.log(`💾 THREATS: Caching position for threat ${highlight.id}:`, highlight.position);
      
      // TODO: Implement API call to update threat position
      // await fetch(`/api/threats/${highlight.id}/position`, {
      //   method: 'PATCH',
      //   body: JSON.stringify({ position: highlight.position }),
      //   headers: { 'Content-Type': 'application/json' }
      // });
    } catch (error) {
      console.error(`💾 THREATS: Failed to cache position for threat ${highlight.id}:`, error);
    }
  };

  // ========================================
  // COMPUTED VALUES
  // ========================================

  /**
   * Filter threat highlights based on search query and severity
   */
  const filteredThreats = threatHighlights.filter((highlight) => {
    const matchesSearch =
      highlight.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      highlight.metadata.note
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());

    const severity = highlight.metadata.tags?.find((tag) =>
      ["critical", "high", "medium", "low"].includes(tag.toLowerCase()),
    );
    const matchesSeverity = !selectedSeverity || severity === selectedSeverity;

    return matchesSearch && matchesSeverity;
  });

  /**
   * Group threats by page number
   */
  const threatsByPage = filteredThreats.reduce(
    (acc, threat) => {
      const pageNum = threat.position.pageNumber;
      if (!acc[pageNum]) {
        acc[pageNum] = [];
      }
      acc[pageNum].push(threat);
      return acc;
    },
    {} as Record<number, Highlight[]>,
  );

  // ========================================
  // EVENT HANDLERS
  // ========================================

  /**
   * Extracts text content from a specific page using Selection API
   */
  const extractPageText = (pageNumber: number): string => {
    console.log(`🔍 THREATS: Extracting text from page ${pageNumber}`);

    if (!textLayerRef.current) {
      console.log("🔍 THREATS: No text layer available");
      return "";
    }

    // Find the page element
    const pageElement = textLayerRef.current.querySelector(
      `[data-page-number="${pageNumber}"]`,
    );
    if (!pageElement) {
      console.log(`🔍 THREATS: Page ${pageNumber} element not found`);
      return "";
    }

    // Extract all text content from the page
    const textContent = pageElement.textContent || "";
    console.log(
      `🔍 THREATS: Extracted ${textContent.length} characters from page ${pageNumber}`,
    );

    return textContent.trim();
  };

  /**
   * Extracts text from all pages using Selection API
   */
  const extractAllPagesText = (): Array<{
    page: number;
    selectionApiContent: string;
  }> => {
    console.log(`🔍 THREATS: Extracting text from all ${numPages} pages`);

    const pagesContent = [];

    for (let pageNum = 1; pageNum <= (numPages || 0); pageNum++) {
      const pageText = extractPageText(pageNum);
      if (pageText.length > 0) {
        pagesContent.push({
          page: pageNum,
          selectionApiContent: pageText,
        });
        console.log(
          `🔍 THREATS: Page ${pageNum}: ${pageText.length} characters`,
        );
      } else {
        console.log(`🔍 THREATS: Page ${pageNum}: No text content`);
      }
    }

    console.log(`🔍 THREATS: Total pages with content: ${pagesContent.length}`);
    return pagesContent;
  };

  /**
   * Helper interface for text node position mapping
   */
  interface TextNodeRange {
    node: Node;
    start: number;
    end: number;
  }

  /**
   * Direct text search and selection approach for simpler matching
   */
  const selectTextDirectly = (
    root: Node | null,
    searchText: string,
  ): boolean => {
    if (!root) return false;

    // Get the full text content
    const fullText = root.textContent || "";
    console.log(`🔍 THREATS: Direct search in ${fullText.length} characters for: "${searchText.substring(0, 30)}..."`);
    
    // Normalize both texts for comparison
    const normalizedFullText = fullText.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedSearchText = searchText.replace(/\s+/g, ' ').trim().toLowerCase();
    
    // Find the position
    const position = normalizedFullText.indexOf(normalizedSearchText);
    if (position === -1) {
      console.log('🔍 THREATS: Normalized text not found');
      return false;
    }
    
    console.log(`🔍 THREATS: Found normalized text at position ${position}`);
    
    // Try to select using the simple text search
    return selectTextByPosition(root, searchText, position);
  };

  /**
   * Select text by finding it at a specific position in the content
   */
  const selectTextByPosition = (
    root: Node,
    targetText: string,
    approximatePosition: number
  ): boolean => {
    // Create a tree walker to find text nodes
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentPosition = 0;
    let foundNode: Node | null = null;
    let nodeStartPosition = 0;

    // Find the text node that contains our approximate position
    let node;
    while ((node = walker.nextNode())) {
      const nodeText = node.textContent || "";
      const nodeEndPosition = currentPosition + nodeText.length;
      
      if (approximatePosition >= currentPosition && approximatePosition < nodeEndPosition) {
        foundNode = node;
        nodeStartPosition = currentPosition;
        break;
      }
      currentPosition = nodeEndPosition;
    }

    if (!foundNode) {
      console.log('🔍 THREATS: Could not find text node at position');
      return false;
    }

    // Try to select the target text starting from this node
    const range = document.createRange();
    const nodeOffset = approximatePosition - nodeStartPosition;
    
    try {
      range.setStart(foundNode, Math.max(0, nodeOffset));
      range.setEnd(foundNode, Math.min(foundNode.textContent?.length || 0, nodeOffset + targetText.length));
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
        console.log('✅ THREATS: Successfully selected text using position method');
        return true;
      }
    } catch (error) {
      console.log('🔍 THREATS: Error selecting text by position:', error);
    }

    return false;
  };

  /**
   * Finds and selects text that may span multiple text nodes/divs
   */
  const selectTextWordByWord = (
    root: Node | null,
    searchText: string,
  ): boolean => {
    if (!root) return false;

    // Split search text into words, preserving original spacing
    const words = searchText.split(/(\s+)/); // This keeps whitespace as separate elements
    if (words.length === 0) return false;

    // Collect all text nodes
    const walker: TreeWalker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
    );
    const textNodes: Node[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent && node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    if (textNodes.length === 0) return false;

    // Build full text with position mapping
    let fullText = "";
    const nodeRanges: TextNodeRange[] = [];
    for (const n of textNodes) {
      nodeRanges.push({
        node: n,
        start: fullText.length,
        end: fullText.length + (n.textContent?.length ?? 0),
      });
      fullText += n.textContent ?? "";
    }

    // Find all possible starting positions for the first word
    const firstWord = words[0].trim();
    const startPositions: number[] = [];
    let searchFrom = 0;

    while (true) {
      const pos = fullText
        .toLowerCase()
        .indexOf(firstWord.toLowerCase(), searchFrom);
      if (pos === -1) break;
      startPositions.push(pos);
      searchFrom = pos + 1;
    }

    // Try each starting position
    for (const startPos of startPositions) {
      const matchResult = findWordsFromPosition(fullText, words, startPos);
      if (matchResult) {
        // Convert positions to node+offset
        const startNodeInfo = getNodeFromPosition(
          nodeRanges,
          matchResult.start,
        );
        const endNodeInfo = getNodeFromPosition(nodeRanges, matchResult.end);

        if (startNodeInfo && endNodeInfo) {
          const range = document.createRange();
          range.setStart(startNodeInfo.node, startNodeInfo.offset);
          range.setEnd(endNodeInfo.node, endNodeInfo.offset);

          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
            return true;
          }
        }
      }
    }

    return false;
  };

  const findWordsFromPosition = (
    fullText: string,
    words: string[],
    startPos: number,
  ): { start: number; end: number } | null => {
    let currentPos = startPos;
    const textLower = fullText.toLowerCase();

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      if (word.trim() === "") {
        // It's whitespace, skip over any whitespace in the text
        while (
          currentPos < fullText.length &&
          /\s/.test(fullText[currentPos])
        ) {
          currentPos++;
        }
        continue;
      }

      // Look for the word at current position
      const wordLower = word.toLowerCase();
      const foundAt = textLower.indexOf(wordLower, currentPos);

      if (foundAt === -1) {
        return null; // Word not found
      }

      // Check if this word is reasonably close to where we expect it
      // Allow some whitespace/punctuation between words
      const gap = foundAt - currentPos;
      if (gap > 50) {
        return null; // Too much gap, probably not the right sequence
      }

      // Skip to after this word
      currentPos = foundAt + word.length;
    }

    return { start: startPos, end: currentPos };
  };

  const getNodeFromPosition = (
    nodeRanges: TextNodeRange[],
    position: number,
  ): { node: Node; offset: number } | null => {
    for (const { node, start, end } of nodeRanges) {
      if (position >= start && position <= end) {
        return { node, offset: position - start };
      }
    }
    return null;
  };

  /**
   * Converts threat response to Highlight object
   */
  const createHighlightFromThreat = (
    threatText: string,
    explanation: string,
    pageNumber: number,
    threatNumber: number,
  ): Highlight | null => {
    console.log(
      `🔍 THREATS: Creating highlight for threat: "${threatText}" on page ${pageNumber}`,
    );

    if (!textLayerRef.current) {
      console.log("🔍 THREATS: No text layer available for highlight creation");
      return null;
    }

    // Find the page element
    const pageElement = textLayerRef.current.querySelector(
      `[data-page-number="${pageNumber}"]`,
    );
    if (!pageElement) {
      console.log(`🔍 THREATS: Page ${pageNumber} element not found`);
      return null;
    }

    // Use Selection API to find the exact text
    const selection = window.getSelection();
    if (!selection) {
      console.log("🔍 THREATS: No selection API available");
      return null;
    }

    // Clear any existing selection
    selection.removeAllRanges();

    try {
      // Use the improved word-by-word selection for multi-div text
      const found = selectTextWordByWord(pageElement, threatText);

      if (found) {
        console.log(
          `🔍 THREATS: Found threat text using word-by-word selection`,
        );

        // Get the current selection that was just applied
        const currentSelection = window.getSelection();
        if (!currentSelection || currentSelection.rangeCount === 0) {
          console.log(
            "🔍 THREATS: No active selection found after text selection",
          );
          return null;
        }

        const range = currentSelection.getRangeAt(0);

        // Calculate DOCUMENT-ABSOLUTE offsets using the entire text layer
        const startOffset = getTextOffsetInDocument(
          range.startContainer,
          range.startOffset,
        );
        const endOffset = getTextOffsetInDocument(
          range.endContainer,
          range.endOffset,
        );

        console.log(
          `🔍 THREATS: Document offsets - start: ${startOffset}, end: ${endOffset}`,
        );

        const id = `threat-${Date.now()}-${threatNumber}`;
        const timestamp = new Date().toISOString();

        // Determine threat severity and color
        const severity = determineThreatSeverity(explanation);
        const color = getThreatColor();

        const highlight: Highlight = {
          id,
          text: threatText,
          position: {
            startOffset,
            endOffset,
            pageNumber,
            startPageOffset: startOffset, // Use document offset for consistency
            endPageOffset: endOffset,
          },
          color,
          metadata: {
            id,
            text: threatText,
            note: explanation,
            tags: ["threat", "security", severity],
            createdAt: timestamp,
            author: "threat-analyzer",
          },
          isActive: false,
          isTemporary: false,
        };

        console.log(
          `✅ THREATS: Created highlight for "${threatText}" with severity ${severity}`,
        );
        return highlight;
      } else {
        console.log(
          `⚠️ THREATS: Could not locate threat text "${threatText}" on page ${pageNumber} using word-by-word selection`,
        );
        return null;
      }
    } catch (error) {
      console.log(
        `🔍 THREATS: Error creating highlight for "${threatText}":`,
        error,
      );
      return null;
    }
  };

  /**
   * Calculate text offset within a specific page (page-relative)
   * Uses the same TreeWalker logic as the main highlighting system
   */
  const getTextOffsetInPage = (
    pageTextLayer: Element,
    targetNode: Node,
    targetOffset: number,
  ): number => {
    // Use the exact same TreeWalker logic as the highlighting utils
    let textOffset = 0;
    const walker = document.createTreeWalker(
      pageTextLayer,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      if (currentNode === targetNode) {
        return textOffset + targetOffset;
      }
      textOffset += currentNode.textContent?.length || 0;
    }

    return textOffset;
  };

  /**
   * Calculate text offset within the entire document (document-absolute)
   */
  const getTextOffsetInDocument = (
    targetNode: Node,
    targetOffset: number,
  ): number => {
    if (!textLayerRef.current) return 0;

    const walker = document.createTreeWalker(
      textLayerRef.current, // Walk through entire text layer, not just the page
      NodeFilter.SHOW_TEXT,
      null,
    );

    let totalOffset = 0;
    let node;

    while ((node = walker.nextNode())) {
      if (node === targetNode) {
        return totalOffset + targetOffset;
      }
      totalOffset += node.textContent?.length || 0;
    }

    return totalOffset;
  };

  /**
   * Convert page-relative offset to document-absolute offset
   * Uses textLayerRef to match the highlighting system exactly
   */
  const convertPageOffsetToDocumentOffset = (
    pageNumber: number,
    pageRelativeOffset: number,
  ): number => {
    if (!textLayerRef?.current) {
      console.warn('🔍 THREATS: textLayerRef not available for offset conversion');
      return pageRelativeOffset;
    }

    let documentOffset = 0;
    console.log(`🔍 THREATS: Converting page ${pageNumber} offset ${pageRelativeOffset} to document offset`);

    // Add text from all previous pages using textLayerRef (same as highlighting system)
    for (let pageNum = 1; pageNum < pageNumber; pageNum++) {
      const pageElement = textLayerRef.current.querySelector(
        `[data-page-number="${pageNum}"] .react-pdf__Page__textContent`
      );
      if (pageElement) {
        const pageText = pageElement.textContent || "";
        console.log(`🔍 THREATS: Page ${pageNum} text length: ${pageText.length}, adding to offset`);
        documentOffset += pageText.length;
      } else {
        console.warn(`🔍 THREATS: Could not find text content for page ${pageNum}`);
      }
    }

    console.log(`🔍 THREATS: Total offset from previous pages: ${documentOffset}, adding page offset: ${pageRelativeOffset}`);

    // Add the page-relative offset
    documentOffset += pageRelativeOffset;
    
    console.log(`🔍 THREATS: Final document offset: ${documentOffset}`);

    return documentOffset;
  };

  /**
   * Determines threat severity based on explanation text
   */
  const determineThreatSeverity = (explanation: string): string => {
    const lowerExplanation = explanation.toLowerCase();

    if (
      lowerExplanation.includes("critical") ||
      lowerExplanation.includes("severe") ||
      lowerExplanation.includes("dangerous") ||
      lowerExplanation.includes("malicious")
    ) {
      return "critical";
    } else if (
      lowerExplanation.includes("high") ||
      lowerExplanation.includes("serious") ||
      lowerExplanation.includes("vulnerability") ||
      lowerExplanation.includes("injection")
    ) {
      return "high";
    } else if (
      lowerExplanation.includes("medium") ||
      lowerExplanation.includes("moderate") ||
      lowerExplanation.includes("suspicious") ||
      lowerExplanation.includes("potential")
    ) {
      return "medium";
    } else {
      return "low";
    }
  };

  /**
   * Gets the appropriate color for threat severity - all threats use red
   */
  const getThreatColor = (severity?: string): HighlightColor => {
    const normalized = severity?.toLowerCase();
    if (normalized === "critical") return THREAT_COLORS[0];
    if (normalized === "high") return THREAT_COLORS[1] || THREAT_COLORS[0];
    if (normalized === "medium") return THREAT_COLORS[2] || THREAT_COLORS[0];
    if (normalized === "low") return THREAT_COLORS[3] || THREAT_COLORS[0];
    return THREAT_COLORS[0];
  };

  /**
   * Main threat analysis function - now uses provider functionality
   */
  const handleAnalyzePdf = async () => {
    console.log("🔍 THREATS: Starting PDF threat analysis via provider");

    if (!documentId || documentId === "test") {
      console.log("🔍 THREATS: No document ID available for analysis");
      return;
    }

    if (!numPages || numPages === 0) {
      console.log("🔍 THREATS: No pages available for analysis");
      return;
    }

    // Use provider's threat generation functionality
    await generateThreatsAnalysis();

    // The provider will automatically update the threats state, which will
    // trigger our useEffect to sync the local state
  };

  /**
   * Handles downloading threats as PDF
   */
  const handleDownloadThreats = async () => {
    console.log("📄 Starting threats PDF download...");

    if (threatHighlights.length === 0) {
      console.log("⚠️ No threats to download");
      return;
    }

    setIsDownloading(true);

    try {
      // Extract document name from PDF URL or use default
      const documentName = pdfUrl
        ? pdfUrl.split("/").pop()?.replace(".pdf", "") || "Document"
        : "Document";

      generateThreatsPDF(threatHighlights, documentName);
      console.log("✅ Threats PDF downloaded successfully");
    } catch (error) {
      console.error("❌ Error downloading threats PDF:", error);
      // You could add a toast notification here if available
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  /**
   * Gets the appropriate icon for threat severity
   */
  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case "critical":
        return <ShieldAlertIcon className="h-4 w-4 text-red-600" />;
      case "high":
        return <AlertTriangleIcon className="h-4 w-4 text-orange-600" />;
      case "medium":
        return <AlertCircleIcon className="h-4 w-4 text-yellow-600" />;
      case "low":
        return <InfoIcon className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertTriangleIcon className="h-4 w-4 text-orange-600" />;
    }
  };

  /**
   * Gets the appropriate color class for threat severity
   */
  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "critical":
        return "border-red-600 bg-red-50 text-red-800";
      case "high":
        return "border-orange-600 bg-orange-50 text-orange-800";
      case "medium":
        return "border-yellow-600 bg-yellow-50 text-yellow-800";
      case "low":
        return "border-blue-600 bg-blue-50 text-blue-800";
      default:
        return "border-orange-600 bg-orange-50 text-orange-800";
    }
  };

  // ========================================
  // RENDER HELPERS
  // ========================================

  /**
   * Renders the search and control section
   */
  const renderControlSection = () => (
    <div className="flex shrink-0 flex-col gap-4 p-4">
      <div className="relative">
        <SearchIcon className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
        <Input
          placeholder="Search threats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedSeverity === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedSeverity(null)}
        >
          All
        </Button>
        {["critical", "high", "medium", "low"].map((severity) => (
          <Button
            key={severity}
            variant={selectedSeverity === severity ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSeverity(severity)}
            className="capitalize"
          >
            {severity}
          </Button>
        ))}
      </div>

      {/* Only show analyze button if threats don't exist yet */}
      {!threatsExist && !isLoading && (
        <Button
          onClick={handleAnalyzePdf}
          disabled={
            isAnalyzing || !numPages || !documentId || documentId === "test"
          }
          className="w-full"
        >
          {isAnalyzing ? (
            <div className="flex items-center gap-2">
              <ScanIcon className="h-4 w-4 animate-spin" />
              {analysisProgress.total > 0
                ? `Analyzing... (${analysisProgress.current}/${analysisProgress.total})`
                : "Analyzing..."}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ScanIcon className="h-4 w-4" />
              Detect Threats
            </div>
          )}
        </Button>
      )}

      {/* Show loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <ScanIcon className="h-4 w-4 animate-spin" />
          Loading threats...
        </div>
      )}

      {/* Show download button only if threats exist */}
      {threatsExist && threatHighlights.length > 0 && (
        <Button
          onClick={handleDownloadThreats}
          disabled={isDownloading}
          variant="outline"
          className="w-full"
        >
          {isDownloading ? (
            <div className="flex items-center gap-2">
              <DownloadIcon className="h-4 w-4 animate-spin" />
              Generating PDF...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <DownloadIcon className="h-4 w-4" />
              Download Threats ({threatHighlights.length})
            </div>
          )}
        </Button>
      )}

      {isAnalyzing && analysisProgress.total > 0 && (
        <div className="bg-muted h-2 w-full rounded-full">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(analysisProgress.current / analysisProgress.total) * 100}%`,
            }}
          />
        </div>
      )}
    </div>
  );

  /**
   * Renders threat summary statistics based on highlight data
   */
  const renderSummary = () => {
    if (threatHighlights.length === 0) return null;

    const severityCounts = threatHighlights.reduce(
      (acc, highlight) => {
        const severity =
          highlight.metadata.tags?.find((tag) =>
            ["critical", "high", "medium", "low"].includes(tag.toLowerCase()),
          ) || "high";
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return (
      <div className="px-4 pb-4">
        <div className="mb-2 text-sm font-medium">Threat Summary</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-600"></div>
            Critical: {severityCounts.critical || 0}
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-orange-600"></div>
            High: {severityCounts.high || 0}
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-yellow-600"></div>
            Medium: {severityCounts.medium || 0}
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-blue-600"></div>
            Low: {severityCounts.low || 0}
          </div>
        </div>
      </div>
    );
  };

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <div className="flex h-full w-full max-w-sm flex-col">
      {/* Control Section */}
      {renderControlSection()}

      {/* Summary Section */}
      {renderSummary()}

      {/* Threats List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        <div className="space-y-3">
          {isAnalyzing && (
            <div className="text-muted-foreground py-8 text-center">
              <div className="border-primary mx-auto mb-2 h-8 w-8 animate-spin border-b-2"></div>
              <p>Analyzing PDF for security threats...</p>
              {analysisProgress.total > 0 && (
                <p className="mt-1 text-xs">
                  Processing {analysisProgress.current} of{" "}
                  {analysisProgress.total} threats
                </p>
              )}
            </div>
          )}

          {!isAnalyzing && threatHighlights.length > 0 && (
            <AnimatePresence>
              {Object.entries(threatsByPage).map(([pageNum, pageThreats]) => (
                <motion.div
                  key={pageNum}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-2"
                >
                  <div className="text-muted-foreground text-sm font-medium">
                    Page {pageNum} ({pageThreats.length} threat
                    {pageThreats.length !== 1 ? "s" : ""})
                  </div>

                  {pageThreats.map((threat) => {
                    const severity =
                      threat.metadata.tags?.find((tag) =>
                        ["critical", "high", "medium", "low"].includes(
                          tag.toLowerCase(),
                        ),
                      ) || "high";

                    return (
                      <motion.div
                        key={threat.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "hover:bg-muted/50 cursor-pointer space-y-2 rounded-lg border p-3 transition-colors",
                          getSeverityColor(severity),
                        )}
                        onClick={() => jumpToHighlight(threat)}
                      >
                        {/* Threat Header */}
                        <div className="flex items-start gap-2">
                          {getSeverityIcon(severity)}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              &quot;{threat.text}&quot;
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs capitalize",
                                  getSeverityColor(severity),
                                )}
                              >
                                {severity}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Jump to threat"
                            onClick={(e) => {
                              e.stopPropagation();
                              jumpToHighlight(threat);
                            }}
                          >
                            <EyeIcon className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Threat Explanation */}
                        {threat.metadata.note && (
                          <div className="text-muted-foreground text-xs leading-relaxed">
                            {threat.metadata.note}
                          </div>
                        )}

                        {/* Threat Tags */}
                        {threat.metadata.tags &&
                          threat.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {threat.metadata.tags
                                .filter(
                                  (tag) =>
                                    ![
                                      "critical",
                                      "high",
                                      "medium",
                                      "low",
                                    ].includes(tag.toLowerCase()),
                                )
                                .map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                            </div>
                          )}

                        {/* Metadata */}
                        <div className="text-muted-foreground text-xs">
                          Created:{" "}
                          {new Date(threat.metadata.createdAt).toLocaleString()}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {/* Empty State */}
          {!isAnalyzing && !isLoading && filteredThreats.length === 0 && (
            <div className="text-muted-foreground py-8 text-center">
              {!threatsExist ? (
                <div>
                  <ShieldAlertIcon className="mx-auto mb-2 h-12 w-12 opacity-50" />
                  <p>No threat analysis yet</p>
                  <p className="text-xs">
                    {documentId && documentId !== "test"
                      ? 'Click "Detect Threats" to scan for security threats'
                      : "Threat analysis not available for test documents"}
                  </p>
                </div>
              ) : searchQuery || selectedSeverity ? (
                "No threats match your filters"
              ) : (
                <div>
                  <ShieldAlertIcon className="mx-auto mb-2 h-12 w-12 text-green-500" />
                  <p>No threats detected</p>
                  <p className="text-xs">This PDF appears to be safe</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
