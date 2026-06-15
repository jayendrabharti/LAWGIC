import { DEFAULT_HIGHLIGHT_COLOR, type HighlightColor } from "./types";

export type TextLayerHighlightKind = "highlight" | "threat";

export type TextLayerHighlightInput = {
  id: string;
  text: string;
  pageNumber: number;
  color?: HighlightColor | string | null;
  title?: string;
  kind: TextLayerHighlightKind;
  severity?: string;
  payload?: unknown;
};

type DomCharPosition = {
  node: Text;
  offset: number;
  virtual?: boolean;
};

type IndexedTextNode = {
  node: Text;
  text: string;
  rect: DOMRect | null;
};

type PageTextIndex = {
  textLayer: HTMLElement;
  pageElement: HTMLElement;
  displayText: string;
  normalizedText: string;
  normalizedToDom: DomCharPosition[];
};

type TextMatch = {
  start: number;
  end: number;
  confidence: number;
  matchType: "exact" | "loose";
};

type UsedRange = {
  start: number;
  end: number;
};

const OVERLAY_CLASS = "pdf-text-match-overlay-layer";
const RECT_CLASS = "pdf-text-match-overlay-rect";

function normalizeChar(char: string): string {
  return char
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .toLowerCase();
}

export function normalizeForSearch(text: string): string {
  let normalized = "";
  let lastWasSpace = false;

  for (const originalChar of text) {
    const char = normalizeChar(originalChar);
    if (!char) continue;

    if (/\s/.test(char)) {
      if (!lastWasSpace) {
        normalized += " ";
        lastWasSpace = true;
      }
      continue;
    }

    normalized += char;
    lastWasSpace = false;
  }

  return normalized.trim();
}

function getTextLayer(pageElement: HTMLElement): HTMLElement | null {
  return pageElement.querySelector(
    ".react-pdf__Page__textContent",
  ) as HTMLElement | null;
}

function getTextNodes(textLayer: HTMLElement): IndexedTextNode[] {
  const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
  const nodes: IndexedTextNode[] = [];
  let current: Node | null;

  while ((current = walker.nextNode())) {
    const node = current as Text;
    const text = node.textContent || "";
    if (!text) continue;

    const parentElement = node.parentElement;
    nodes.push({
      node,
      text,
      rect: parentElement ? parentElement.getBoundingClientRect() : null,
    });
  }

  return nodes;
}

function shouldInsertSpace(previous: IndexedTextNode | null, current: IndexedTextNode): boolean {
  if (!previous) return false;

  const previousText = previous.text;
  const currentText = current.text;
  if (!previousText || !currentText) return false;
  if (/\s$/.test(previousText) || /^\s/.test(currentText)) return false;
  if (previousText.endsWith("-")) return false;

  const previousRect = previous.rect;
  const currentRect = current.rect;
  if (!previousRect || !currentRect) return true;

  const lineTolerance = Math.max(2, previousRect.height * 0.35);
  const isDifferentLine = Math.abs(previousRect.top - currentRect.top) > lineTolerance;
  if (isDifferentLine) return true;

  const horizontalGap = currentRect.left - previousRect.right;
  return horizontalGap > Math.max(1.5, previousRect.height * 0.08);
}

function appendNormalizedChar(
  normalizedChar: string,
  position: DomCharPosition,
  state: { normalizedText: string; normalizedToDom: DomCharPosition[]; lastWasSpace: boolean },
) {
  if (!normalizedChar) return;

  if (/\s/.test(normalizedChar)) {
    if (!state.lastWasSpace) {
      state.normalizedText += " ";
      state.normalizedToDom.push(position);
      state.lastWasSpace = true;
    }
    return;
  }

  state.normalizedText += normalizedChar;
  state.normalizedToDom.push(position);
  state.lastWasSpace = false;
}

export function buildPageTextIndex(pageElement: HTMLElement): PageTextIndex | null {
  const textLayer = getTextLayer(pageElement);
  if (!textLayer) return null;

  const nodes = getTextNodes(textLayer);
  if (nodes.length === 0) return null;

  const state = {
    normalizedText: "",
    normalizedToDom: [] as DomCharPosition[],
    lastWasSpace: false,
  };

  let displayText = "";
  let previousNode: IndexedTextNode | null = null;

  for (const indexedNode of nodes) {
    if (shouldInsertSpace(previousNode, indexedNode)) {
      displayText += " ";
      appendNormalizedChar(" ", {
        node: indexedNode.node,
        offset: 0,
        virtual: true,
      }, state);
    }

    for (let offset = 0; offset < indexedNode.text.length; offset++) {
      const char = indexedNode.text[offset];
      displayText += char;
      appendNormalizedChar(normalizeChar(char), {
        node: indexedNode.node,
        offset,
      }, state);
    }

    previousNode = indexedNode;
  }

  return {
    textLayer,
    pageElement,
    displayText: displayText.replace(/\s+/g, " ").trim(),
    normalizedText: state.normalizedText,
    normalizedToDom: state.normalizedToDom,
  };
}

function rangesOverlap(a: UsedRange, b: UsedRange): boolean {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
}

function isRangeFree(start: number, end: number, usedRanges: UsedRange[]): boolean {
  return !usedRanges.some((range) => rangesOverlap({ start, end }, range));
}

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ""))
    .filter((token) => token.length >= 3);
}

function scoreTokenCoverage(queryTokens: string[], windowText: string): number {
  if (queryTokens.length === 0) return 0;
  const windowTokens = new Set(tokenize(windowText));
  let hits = 0;

  for (const token of queryTokens) {
    if (windowTokens.has(token)) hits++;
  }

  return hits / queryTokens.length;
}

function findTextMatch(
  index: PageTextIndex,
  text: string,
  usedRanges: UsedRange[],
): TextMatch | null {
  const query = normalizeForSearch(text);
  if (!query || query.length < 2) return null;

  let searchFrom = 0;
  while (searchFrom < index.normalizedText.length) {
    const foundAt = index.normalizedText.indexOf(query, searchFrom);
    if (foundAt === -1) break;

    const end = foundAt + query.length;
    if (isRangeFree(foundAt, end, usedRanges)) {
      return {
        start: foundAt,
        end,
        confidence: 1,
        matchType: "exact",
      };
    }

    searchFrom = foundAt + Math.max(query.length, 1);
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length < 4) return null;

  const firstUsefulToken = queryTokens[0];
  let bestMatch: TextMatch | null = null;
  searchFrom = 0;

  while (searchFrom < index.normalizedText.length) {
    const candidateStart = index.normalizedText.indexOf(firstUsefulToken, searchFrom);
    if (candidateStart === -1) break;

    const expectedLength = query.length;
    const candidateEnd = Math.min(index.normalizedText.length, candidateStart + expectedLength);
    const paddedEnd = Math.min(index.normalizedText.length, candidateStart + expectedLength + 80);
    const window = index.normalizedText.slice(candidateStart, paddedEnd);
    const score = scoreTokenCoverage(queryTokens, window);

    if (score >= 0.86 && isRangeFree(candidateStart, candidateEnd, usedRanges)) {
      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = {
          start: candidateStart,
          end: candidateEnd,
          confidence: score,
          matchType: "loose",
        };
      }
    }

    searchFrom = candidateStart + firstUsefulToken.length;
  }

  return bestMatch;
}

function getRealPosition(
  positions: DomCharPosition[],
  index: number,
  direction: "forward" | "backward",
): DomCharPosition | null {
  let cursor = index;

  while (cursor >= 0 && cursor < positions.length) {
    const position = positions[cursor];
    if (position && !position.virtual) return position;
    cursor += direction === "forward" ? 1 : -1;
  }

  return null;
}

function getRectsForMatch(index: PageTextIndex, match: TextMatch): DOMRect[] {
  const startPosition = getRealPosition(index.normalizedToDom, match.start, "forward");
  const endPosition = getRealPosition(index.normalizedToDom, match.end - 1, "backward");

  if (!startPosition || !endPosition) return [];

  try {
    const range = document.createRange();
    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset + 1);

    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0 && rect.height > 0,
    );
    range.detach();
    return rects;
  } catch (error) {
    console.warn("Failed to create range for text highlight:", error);
    return [];
  }
}

function mergeCloseRects(rects: Array<{ left: number; top: number; width: number; height: number }>) {
  const sorted = [...rects].sort((a, b) => {
    if (Math.abs(a.top - b.top) > 2) return a.top - b.top;
    return a.left - b.left;
  });

  const merged: Array<{ left: number; top: number; width: number; height: number }> = [];

  for (const rect of sorted) {
    const previous = merged[merged.length - 1];

    if (
      previous &&
      Math.abs(previous.top - rect.top) <= 2 &&
      Math.abs(previous.height - rect.height) <= 3 &&
      rect.left <= previous.left + previous.width + 4
    ) {
      const right = Math.max(previous.left + previous.width, rect.left + rect.width);
      previous.left = Math.min(previous.left, rect.left);
      previous.width = right - previous.left;
      previous.top = Math.min(previous.top, rect.top);
      previous.height = Math.max(previous.height, rect.height);
    } else {
      merged.push({ ...rect });
    }
  }

  return merged;
}

function resolveColor(color: TextLayerHighlightInput["color"]): HighlightColor {
  if (!color) return DEFAULT_HIGHLIGHT_COLOR;
  if (typeof color !== "string") return color;

  return {
    id: color,
    name: color,
    backgroundColor: color,
  };
}

function preparePageElement(pageElement: HTMLElement) {
  if (getComputedStyle(pageElement).position === "static") {
    pageElement.style.position = "relative";
  }
}

function getOrCreateOverlayLayer(pageElement: HTMLElement): HTMLDivElement {
  preparePageElement(pageElement);

  let layer = pageElement.querySelector(`.${OVERLAY_CLASS}`) as HTMLDivElement | null;
  if (layer) {
    layer.innerHTML = "";
    return layer;
  }

  layer = document.createElement("div");
  layer.className = OVERLAY_CLASS;
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "20";
  pageElement.appendChild(layer);
  return layer;
}

export function clearTextHighlightOverlays(root: ParentNode = document) {
  root.querySelectorAll(`.${OVERLAY_CLASS}`).forEach((layer) => layer.remove());
}

export function getRenderedPageText(pageElement: HTMLElement): string {
  return buildPageTextIndex(pageElement)?.displayText || "";
}

export function renderPageTextHighlights(
  pageElement: HTMLElement,
  items: TextLayerHighlightInput[],
  onClick?: (item: TextLayerHighlightInput, event: MouseEvent) => void,
) {
  const layer = getOrCreateOverlayLayer(pageElement);
  if (items.length === 0) return;

  const index = buildPageTextIndex(pageElement);
  if (!index) return;

  const pageRect = pageElement.getBoundingClientRect();
  const usedRanges: UsedRange[] = [];

  for (const item of items) {
    const match = findTextMatch(index, item.text, usedRanges);
    if (!match) {
      console.warn("Could not find text for PDF overlay highlight:", {
        id: item.id,
        pageNumber: item.pageNumber,
        text: item.text?.slice(0, 120),
        kind: item.kind,
      });
      continue;
    }

    const clientRects = getRectsForMatch(index, match);
    const relativeRects = mergeCloseRects(
      clientRects.map((rect) => ({
        left: rect.left - pageRect.left,
        top: rect.top - pageRect.top,
        width: rect.width,
        height: rect.height,
      })),
    );

    if (relativeRects.length === 0) continue;

    usedRanges.push({ start: match.start, end: match.end });

    const color = resolveColor(item.color);

    relativeRects.forEach((rect, rectIndex) => {
      const element = document.createElement("div");
      element.className = `${RECT_CLASS} ${item.kind === "threat" ? "pdf-threat-highlight" : "text-highlight"}`;
      element.dataset.highlightId = item.id;
      if (item.kind === "threat") element.dataset.threatId = item.id;
      element.dataset.pageNumber = String(item.pageNumber);
      element.dataset.matchType = match.matchType;
      element.dataset.matchConfidence = String(match.confidence);
      element.title = item.title || item.text;

      element.style.position = "absolute";
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      element.style.width = `${rect.width}px`;
      element.style.height = `${rect.height}px`;
      element.style.backgroundColor = color.backgroundColor;
      element.style.borderRadius = "2px";
      element.style.pointerEvents = "auto";
      element.style.cursor = "pointer";
      element.style.opacity = item.kind === "threat" ? "0.42" : "0.48";
      element.style.mixBlendMode = "multiply";

      if (color.borderColor) {
        element.style.borderBottom = `1px solid ${color.borderColor}`;
      }

      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onClick?.(item, event);
      });

      element.setAttribute("aria-label", `${item.kind} ${rectIndex + 1}`);
      layer.appendChild(element);
    });
  }
}
