// ========================================
// THREAT DETECTION TYPES
// ========================================

/**
 * Represents a bounding box for threat location
 *
 * @interface ThreatBoundingBox
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} width - Width of the bounding box
 * @property {number} height - Height of the bounding box
 */
export interface ThreatBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Represents a security threat detected in the PDF
 *
 * @interface Threat
 * @property {string} [id] - Unique identifier for the threat
 * @property {string} text - The threatening text content
 * @property {string} reason - Explanation of why this is considered a threat
 * @property {ThreatBoundingBox | null} bbox - Bounding box for visual highlighting
 * @property {number} confidence - Confidence level (0-1)
 * @property {string} [severity] - Threat severity level
 * @property {string} [category] - Threat category (SQL injection, XSS, etc.)
 * @property {ThreatPosition | null} [position] - Position information for precise highlighting
 * @property {number[]} [wordIndices] - Array of word indices for precise positioning
 */
export interface Threat {
  id?: string;
  text: string;
  reason: string;
  bbox: ThreatBoundingBox | null;
  confidence: number;
  severity?: "low" | "medium" | "high" | "critical";
  category?: string;
  position?: ThreatPosition | null;
  wordIndices?: number[];
  _highlightData?: any; // Store the complete highlight data from backend
}

/**
 * Represents the position of a threat within a document
 * Similar to HighlightPosition but simpler for threats
 *
 * @interface ThreatPosition
 * @property {number} pageNumber - Page number where threat is located
 * @property {number} startOffset - Starting word index
 * @property {number} endOffset - Ending word index (exclusive)
 * @property {string} startXPath - XPath to start node (optional)
 * @property {string} endXPath - XPath to end node (optional)
 */
export interface ThreatPosition {
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  startXPath?: string;
  endXPath?: string;
}

/**
 * Represents threat analysis results for a single page
 *
 * @interface PageThreats
 * @property {number} page - Page number
 * @property {Threat[]} threats - Array of threats found on this page
 * @property {number} totalWords - Total number of words on this page
 */
export interface PageThreats {
  page: number;
  threats: Threat[];
  totalWords: number;
}

/**
 * Represents the complete threat analysis response
 *
 * @interface ThreatAnalysisResult
 * @property {PageThreats[]} pages - Array of page threat results
 * @property {number} totalPages - Total number of pages analyzed
 * @property {number} totalThreats - Total number of threats found
 */
export interface ThreatAnalysisResult {
  pages: PageThreats[];
  totalPages: number;
  totalThreats: number;
}

// ========================================
// HIGHLIGHT COLOR TYPES
// ========================================

/**
 * Represents a color scheme for highlighting text
 *
 * @interface HighlightColor
 * @property {string} id - Unique identifier for the color
 * @property {string} name - Human-readable name for the color
 * @property {string} backgroundColor - CSS background color value
 * @property {string} [borderColor] - Optional CSS border color value
 * @property {string} [textColor] - Optional CSS text color value
 */
export interface HighlightColor {
  id: string;
  name: string;
  backgroundColor: string;
  borderColor?: string;
  textColor?: string;
}

// ========================================
// HIGHLIGHT POSITION TYPES
// ========================================

/**
 * Represents the position of a highlight within a document
 *
 * Contains both absolute text offsets and XPath information for
 * reliable positioning and restoration of highlights.
 *
 * @interface HighlightPosition
 * @property {number} startOffset - Absolute start position in container text
 * @property {number} endOffset - Absolute end position in container text
 * @property {string} [startXPath] - XPath to the start node
 * @property {string} [endXPath] - XPath to the end node
 * @property {number} pageNumber - Page number where highlight appears
 * @property {number} [startPageOffset] - Relative start offset within start node
 * @property {number} [endPageOffset] - Relative end offset within end node
 */
export interface HighlightPosition {
  startOffset: number;
  endOffset: number;
  startXPath?: string;
  endXPath?: string;
  pageNumber: number;
  startPageOffset?: number;
  endPageOffset?: number;
}

// ========================================
// HIGHLIGHT METADATA TYPES
// ========================================

/**
 * Contains metadata and user-generated content for a highlight
 *
 * @interface HighlightMetadata
 * @property {string} id - Unique identifier matching the parent highlight
 * @property {string} text - The actual text content that was highlighted
 * @property {string} [note] - Optional user note attached to the highlight
 * @property {string[]} [tags] - Optional array of user-defined tags
 * @property {string} createdAt - ISO timestamp of when highlight was created
 * @property {string} [updatedAt] - ISO timestamp of last modification
 * @property {string} [author] - Optional author identifier
 * @property {boolean} [needsPositionCalculation] - Whether position calculation is needed
 * @property {string} [matchType] - Type of text match (exact, fuzzy, partial)
 * @property {string} [threatSeverity] - Threat severity level for threat highlights
 * @property {string} [threatType] - Type of threat for threat highlights
 * @property {string} [explanation] - Detailed explanation for threats
 */
export interface HighlightMetadata {
  id: string;
  text: string;
  note?: string;
  tags?: string[];
  createdAt: string;
  updatedAt?: string;
  author?: string;
  needsPositionCalculation?: boolean;
  matchType?: string;
  threatSeverity?: string;
  threatType?: string;
  explanation?: string;
}

// ========================================
// MAIN HIGHLIGHT TYPE
// ========================================

/**
 * Represents a complete highlight with all associated data
 *
 * This is the main data structure for storing and managing highlights
 * in the PDF viewer system.
 *
 * @interface Highlight
 * @property {string} id - Unique identifier for this highlight
 * @property {string} text - The highlighted text content
 * @property {HighlightPosition} position - Position data for rendering
 * @property {HighlightColor} color - Color scheme for visual rendering
 * @property {HighlightMetadata} metadata - Additional user data and metadata
 * @property {boolean} [isActive] - Whether this highlight is currently selected
 * @property {boolean} [isTemporary] - Whether this is a temporary highlight
 */
export interface Highlight {
  id: string;
  text: string;
  position: HighlightPosition;
  color: HighlightColor;
  metadata: HighlightMetadata;
  isActive?: boolean;
  isTemporary?: boolean;
}

// ========================================
// SELECTION TYPES
// ========================================

/**
 * Represents an active text selection that can become a highlight
 *
 * Contains information about the user's current text selection
 * and positioning data for rendering the highlight creation UI.
 *
 * @interface TextSelection
 * @property {string} text - The text that is currently selected
 * @property {number} pageNumber - Page number where selection occurred
 * @property {number} startOffset - Start offset of selection
 * @property {number} endOffset - End offset of selection
 * @property {Range} range - The DOM Range object of the selection
 */
export interface TextSelection {
  text: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  range: Range;
}

/**
 * Represents an active text selection that can become a highlight
 *
 * Contains information about the user's current text selection
 * and positioning data for rendering the highlight creation UI.
 *
 * @interface HighlightSelection
 * @property {string} selectedText - The text that is currently selected
 * @property {number} currentPage - Page number where selection occurred
 * @property {number} x - X coordinate for positioning UI elements
 * @property {number} y - Y coordinate for positioning UI elements
 * @property {DOMRect} selectionRect - Bounding rectangle of the selection
 * @property {boolean} shouldShowBelow - Whether UI should appear below selection
 * @property {Range} [range] - The DOM Range object of the selection
 */
export interface HighlightSelection {
  selectedText: string;
  currentPage: number;
  x: number;
  y: number;
  selectionRect: DOMRect;
  shouldShowBelow: boolean;
  range?: Range;
}

// ========================================
// STATE MANAGEMENT TYPES
// ========================================

/**
 * Represents the complete state of the highlighting system
 *
 * Used for managing the overall state of highlights in the application.
 *
 * @interface HighlightState
 * @property {Highlight[]} highlights - Array of all highlights
 * @property {string} [activeHighlight] - ID of currently active highlight
 * @property {string} [selectedHighlight] - ID of currently selected highlight
 * @property {HighlightColor[]} highlightColors - Available color options
 * @property {HighlightColor} defaultColor - Default color for new highlights
 */
export interface HighlightState {
  highlights: Highlight[];
  activeHighlight?: string;
  selectedHighlight?: string;
  highlightColors: HighlightColor[];
  defaultColor: HighlightColor;
}

// ========================================
// OPTIONS AND CONFIGURATION TYPES
// ========================================

/**
 * Options for creating new highlights
 *
 * @interface HighlightOptions
 * @property {HighlightColor} [color] - Color to use for the highlight
 * @property {string} [note] - Initial note to attach to the highlight
 * @property {string[]} [tags] - Initial tags to attach to the highlight
 * @property {boolean} [temporary] - Whether this should be a temporary highlight
 */
export interface HighlightOptions {
  color?: HighlightColor;
  note?: string;
  tags?: string[];
  temporary?: boolean;
}

// ========================================
// PREDEFINED COLOR CONSTANTS
// ========================================

/**
 * Default highlight colors available in the system
 *
 * These colors are optimized for readability and accessibility
 * across different themes and document types.
 */
export const DEFAULT_HIGHLIGHT_COLORS: HighlightColor[] = [
  {
    id: "yellow",
    name: "Yellow",
    backgroundColor: "rgba(255, 255, 0, 1)",
    borderColor: "rgba(230, 230, 0, 1)",
  },
  {
    id: "green",
    name: "Green",
    backgroundColor: "rgba(144, 238, 144, 1)",
    borderColor: "rgba(125, 216, 125, 1)",
  },
  {
    id: "blue",
    name: "Blue",
    backgroundColor: "rgba(135, 206, 235, 1)",
    borderColor: "rgba(107, 182, 212, 1)",
  },
  {
    id: "pink",
    name: "Pink",
    backgroundColor: "rgba(255, 182, 193, 1)",
    borderColor: "rgba(255, 158, 181, 1)",
  },
  {
    id: "orange",
    name: "Orange",
    backgroundColor: "rgba(255, 165, 0, 1)",
    borderColor: "rgba(230, 149, 0, 1)",
  },
];

/**
 * Threat-specific colors - using opaque red highlighting like normal highlights
 */
export const THREAT_COLORS: HighlightColor[] = [
  {
    id: "threat-critical",
    name: "Critical Threat",
    backgroundColor: "rgba(255, 0, 0 , 1)",
    borderColor: "rgba(255, 0, 0  , 1)",
  },
  {
    id: "threat-high",
    name: "High Threat",
    backgroundColor: "rgba(0,0,255, 1)",
    borderColor: "rgba(0,0,255, 1)",
  },
  {
    id: "threat-medium",
    name: "Medium Threat",
    backgroundColor: "rgba(255, 0, 0, 1)",
    borderColor: "rgba(255, 0, 0, 1)",
  },
  {
    id: "threat-low",
    name: "Low Threat",
    backgroundColor: "rgba(255, 0, 0, 1)",
    borderColor: "rgba(255, 0, 0, 1)",
  },
];

/**
 * The default highlight color (yellow)
 *
 * This is used when no specific color is chosen for a new highlight.
 */
export const DEFAULT_HIGHLIGHT_COLOR = DEFAULT_HIGHLIGHT_COLORS[0];

/**
 * Gets the appropriate color for a threat - all threats use red color
 */
export const getThreatColor = (severity?: string): HighlightColor => {
  const normalized = severity?.toLowerCase();

  if (normalized === "critical") return THREAT_COLORS[0];
  if (normalized === "high") return THREAT_COLORS[1] || THREAT_COLORS[0];
  if (normalized === "medium") return THREAT_COLORS[2] || THREAT_COLORS[0];
  if (normalized === "low") return THREAT_COLORS[3] || THREAT_COLORS[0];

  return THREAT_COLORS[0];
};
