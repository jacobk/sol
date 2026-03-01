import type { RefObject } from "preact";
import { useRef, useState, useCallback, useEffect } from "preact/hooks";

interface UseAutoScrollOptions {
  /** Threshold in pixels from bottom to consider "at bottom" */
  bottomThreshold?: number;
  /** Whether auto-scroll is enabled initially */
  initialEnabled?: boolean;
}

interface UseAutoScrollResult {
  /** Whether auto-scroll is currently active */
  isAutoScrolling: boolean;
  /** Whether the user is currently at the bottom of the scroll container */
  isAtBottom: boolean;
  /** Scroll to the bottom of the container */
  scrollToBottom: () => void;
  /** Call this when new content is added — will auto-scroll if enabled */
  handleContentChange: () => void;
  /** Manually enable auto-scroll (e.g., when user taps "new messages" pill) */
  enableAutoScroll: () => void;
  /** Ref to attach to the scroll container (or use window if not set) */
  containerRef: RefObject<HTMLDivElement>;
  /** Ref to attach to the bottom anchor element */
  bottomRef: RefObject<HTMLDivElement>;
}

/**
 * Smart auto-scroll hook for chat-style UIs.
 *
 * - Auto-scroll is ON by default when entering a view
 * - Auto-scroll PAUSES when user scrolls up (detected via scroll direction)
 * - Auto-scroll RESUMES when user manually scrolls to near-bottom or calls enableAutoScroll
 */
export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollResult {
  const { bottomThreshold = 100, initialEnabled = true } = options;

  const [isAutoScrolling, setIsAutoScrolling] = useState(initialEnabled);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const isScrollingProgrammaticallyRef = useRef(false);

  /** Check if currently at the bottom of the scroll area */
  const checkIsAtBottom = useCallback((): boolean => {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    return docHeight - scrollTop - windowHeight <= bottomThreshold;
  }, [bottomThreshold]);

  /** Scroll to the bottom of the container */
  const scrollToBottom = useCallback(() => {
    isScrollingProgrammaticallyRef.current = true;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // Reset the flag after scroll completes (approximate)
    setTimeout(() => {
      isScrollingProgrammaticallyRef.current = false;
    }, 500);
  }, []);

  /** Enable auto-scroll and scroll to bottom */
  const enableAutoScroll = useCallback(() => {
    setIsAutoScrolling(true);
    scrollToBottom();
  }, [scrollToBottom]);

  /** Called when new content is added — auto-scrolls if enabled */
  const handleContentChange = useCallback(() => {
    if (isAutoScrolling) {
      scrollToBottom();
    }
  }, [isAutoScrolling, scrollToBottom]);

  // Handle scroll events to detect user scroll direction
  useEffect(() => {
    const handleScroll = (): void => {
      const currentScrollTop = window.scrollY;
      const atBottom = checkIsAtBottom();

      setIsAtBottom(atBottom);

      // Don't change auto-scroll state if we're programmatically scrolling
      if (isScrollingProgrammaticallyRef.current) {
        lastScrollTopRef.current = currentScrollTop;
        return;
      }

      // Detect scroll direction
      const scrollDelta = currentScrollTop - lastScrollTopRef.current;
      lastScrollTopRef.current = currentScrollTop;

      // User scrolled up — pause auto-scroll
      if (scrollDelta < -10 && isAutoScrolling) {
        setIsAutoScrolling(false);
      }

      // User scrolled to bottom — re-enable auto-scroll
      if (atBottom && !isAutoScrolling) {
        setIsAutoScrolling(true);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isAutoScrolling, checkIsAtBottom]);

  // Check initial scroll position
  useEffect(() => {
    setIsAtBottom(checkIsAtBottom());
  }, [checkIsAtBottom]);

  return {
    isAutoScrolling,
    isAtBottom,
    scrollToBottom,
    handleContentChange,
    enableAutoScroll,
    containerRef,
    bottomRef,
  };
}
