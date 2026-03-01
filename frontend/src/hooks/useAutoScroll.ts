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
  /** Ref to attach to the scroll container */
  scrollContainerRef: RefObject<HTMLDivElement>;
  /** Ref to attach to the bottom anchor element */
  bottomRef: RefObject<HTMLDivElement>;
}

/**
 * Smart auto-scroll hook for chat-style UIs.
 *
 * - Auto-scroll is ON by default when entering a view
 * - Auto-scroll PAUSES when user scrolls up (detected via scroll direction)
 * - Auto-scroll RESUMES when user manually scrolls to near-bottom or calls enableAutoScroll
 * 
 * Works with a container ref (not window scroll) for proper flex layouts.
 */
export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollResult {
  const { bottomThreshold = 100, initialEnabled = true } = options;

  const [isAutoScrolling, setIsAutoScrolling] = useState(initialEnabled);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef(0);
  const isScrollingProgrammaticallyRef = useRef(false);

  /** Check if currently at the bottom of the scroll area */
  const checkIsAtBottom = useCallback((): boolean => {
    const container = scrollContainerRef.current;
    if (!container) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= bottomThreshold;
  }, [bottomThreshold]);

  /** Scroll to the bottom of the container */
  const scrollToBottom = useCallback(() => {
    const container = scrollContainerRef.current;
    const bottom = bottomRef.current;
    
    if (!container || !bottom) return;
    
    isScrollingProgrammaticallyRef.current = true;
    
    // Use scrollIntoView for smooth scrolling
    bottom.scrollIntoView({ behavior: "smooth", block: "end" });
    
    // Also set scrollTop as fallback
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
    
    // Reset the flag after scroll completes
    setTimeout(() => {
      isScrollingProgrammaticallyRef.current = false;
      setIsAtBottom(true);
    }, 300);
  }, []);

  /** Enable auto-scroll and scroll to bottom */
  const enableAutoScroll = useCallback(() => {
    setIsAutoScrolling(true);
    scrollToBottom();
  }, [scrollToBottom]);

  /** Called when new content is added — auto-scrolls if enabled */
  const handleContentChange = useCallback(() => {
    if (isAutoScrolling) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [isAutoScrolling, scrollToBottom]);

  // Handle scroll events on the container
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = (): void => {
      const currentScrollTop = container.scrollTop;
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

      // User scrolled up significantly — pause auto-scroll
      if (scrollDelta < -10 && isAutoScrolling) {
        setIsAutoScrolling(false);
      }

      // User scrolled to bottom — re-enable auto-scroll
      if (atBottom && !isAutoScrolling) {
        setIsAutoScrolling(true);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [isAutoScrolling, checkIsAtBottom]);

  // Check initial scroll position and scroll to bottom on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && initialEnabled) {
      // Scroll to bottom on initial mount
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
        setIsAtBottom(true);
      });
    }
  }, [initialEnabled]);

  return {
    isAutoScrolling,
    isAtBottom,
    scrollToBottom,
    handleContentChange,
    enableAutoScroll,
    scrollContainerRef,
    bottomRef,
  };
}
