import type { ComponentChildren, JSX } from "preact";
import { useState, useRef, useCallback } from "preact/hooks";

/** Minimum swipe distance before recognizing as horizontal swipe (vs tap or scroll) */
const MIN_SWIPE_DISTANCE = 10;

/** Distance to reveal action buttons */
const REVEAL_THRESHOLD = 80;

/** Left margin to avoid triggering iOS Safari back gesture */
const SAFE_LEFT_MARGIN = 20;

interface SwipeableRowProps {
  /** Main content of the row */
  children: ComponentChildren;
  /** Actions revealed when swiping left */
  actions: ComponentChildren;
  /** Called when row is swiped to reveal actions */
  onReveal?: () => void;
  /** Called when row is swiped back to hide actions */
  onHide?: () => void;
  /** Additional CSS classes */
  class?: string;
  /** Disable swipe functionality */
  disabled?: boolean;
}

/**
 * SwipeableRow - A touch-friendly swipe-to-reveal component.
 *
 * Swipe left to reveal action buttons on the right side.
 * Includes spring-back animation and iOS Safari edge gesture protection.
 *
 * @example
 * ```tsx
 * <SwipeableRow
 *   actions={
 *     <button onClick={handleFork} class="bg-accent px-4">Fork</button>
 *   }
 * >
 *   <div>Row content here</div>
 * </SwipeableRow>
 * ```
 */
export function SwipeableRow({
  children,
  actions,
  onReveal,
  onHide,
  class: className = "",
  disabled = false,
}: SwipeableRowProps): JSX.Element {
  const [translateX, setTranslateX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isSwipingRef = useRef(false);
  const isVerticalScrollRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;

    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    currentXRef.current = touch.clientX;
    isSwipingRef.current = false;
    isVerticalScrollRef.current = false;
    setIsTransitioning(false);

    // Check if touch starts too close to left edge (Safari back gesture zone)
    if (touch.clientX < SAFE_LEFT_MARGIN) {
      isVerticalScrollRef.current = true; // Treat as vertical scroll to ignore
    }
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || isVerticalScrollRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    // Determine direction on first significant movement
    if (!isSwipingRef.current && Math.abs(deltaX) < MIN_SWIPE_DISTANCE && Math.abs(deltaY) < MIN_SWIPE_DISTANCE) {
      return;
    }

    // If vertical movement is dominant, mark as vertical scroll and exit
    if (!isSwipingRef.current && Math.abs(deltaY) > Math.abs(deltaX)) {
      isVerticalScrollRef.current = true;
      return;
    }

    // We're swiping horizontally
    isSwipingRef.current = true;
    currentXRef.current = touch.clientX;

    // Calculate new position
    let newTranslateX = deltaX;

    // If already revealed, adjust from revealed position
    if (isRevealed) {
      newTranslateX = -REVEAL_THRESHOLD + deltaX;
    }

    // Clamp: no positive movement (can't swipe right past start), max negative is reveal threshold + some elasticity
    const maxNegative = REVEAL_THRESHOLD + 30; // Allow slight over-pull
    newTranslateX = Math.max(-maxNegative, Math.min(0, newTranslateX));

    // Add resistance when pulling past threshold
    if (newTranslateX < -REVEAL_THRESHOLD) {
      const overPull = -newTranslateX - REVEAL_THRESHOLD;
      newTranslateX = -REVEAL_THRESHOLD - overPull * 0.3; // 30% of over-pull
    }

    setTranslateX(newTranslateX);

    // Prevent scroll while swiping horizontally
    e.preventDefault();
  }, [disabled, isRevealed]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || !isSwipingRef.current) return;

    setIsTransitioning(true);

    // Determine if we crossed the threshold
    const shouldReveal = Math.abs(translateX) > REVEAL_THRESHOLD / 2;

    if (shouldReveal && !isRevealed) {
      setTranslateX(-REVEAL_THRESHOLD);
      setIsRevealed(true);
      onReveal?.();
    } else if (!shouldReveal && isRevealed) {
      setTranslateX(0);
      setIsRevealed(false);
      onHide?.();
    } else if (shouldReveal && isRevealed) {
      // Stay revealed
      setTranslateX(-REVEAL_THRESHOLD);
    } else {
      // Spring back
      setTranslateX(isRevealed ? -REVEAL_THRESHOLD : 0);
    }

    isSwipingRef.current = false;
  }, [disabled, translateX, isRevealed, onReveal, onHide]);

  /** Close the revealed actions */
  const close = useCallback(() => {
    if (!isRevealed) return;
    setIsTransitioning(true);
    setTranslateX(0);
    setIsRevealed(false);
    onHide?.();
  }, [isRevealed, onHide]);

  // Close when tapping on the content while revealed
  const handleContentClick = useCallback((e: MouseEvent) => {
    if (isRevealed) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }, [isRevealed, close]);

  return (
    <div class={`relative overflow-hidden ${className}`}>
      {/* Actions container - positioned behind, revealed by swiping */}
      <div
        class="absolute right-0 top-0 bottom-0 flex items-stretch"
        style={{ width: `${REVEAL_THRESHOLD}px` }}
      >
        {actions}
      </div>

      {/* Main content - slides left to reveal actions */}
      <div
        class={`relative bg-bg-app ${isTransitioning ? "transition-transform duration-200 ease-out" : ""}`}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={handleContentClick}
      >
        {children}
      </div>
    </div>
  );
}
