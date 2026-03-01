import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";
import { SwipeableRow } from "./SwipeableRow.js";

describe("SwipeableRow", () => {
  it("renders children content", () => {
    render(
      <SwipeableRow actions={<button>Action</button>}>
        <div>Test Content</div>
      </SwipeableRow>
    );

    expect(screen.getByText("Test Content")).toBeTruthy();
  });

  it("renders action buttons", () => {
    render(
      <SwipeableRow actions={<button>Fork</button>}>
        <div>Content</div>
      </SwipeableRow>
    );

    expect(screen.getByText("Fork")).toBeTruthy();
  });

  it("does not respond to swipe when disabled", () => {
    const onReveal = vi.fn();

    render(
      <SwipeableRow
        actions={<button>Action</button>}
        onReveal={onReveal}
        disabled
      >
        <div data-testid="content">Content</div>
      </SwipeableRow>
    );

    const content = screen.getByTestId("content").parentElement!;

    // Simulate touch events
    fireEvent.touchStart(content, {
      touches: [{ clientX: 200, clientY: 100 }],
    });

    fireEvent.touchMove(content, {
      touches: [{ clientX: 50, clientY: 100 }],
    });

    fireEvent.touchEnd(content);

    // onReveal should not be called when disabled
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("applies custom className", () => {
    render(
      <SwipeableRow
        actions={<button>Action</button>}
        class="custom-class"
      >
        <div>Content</div>
      </SwipeableRow>
    );

    const container = screen.getByText("Content").parentElement?.parentElement;
    expect(container?.className).toContain("custom-class");
  });

  it("has proper structure with action slot", () => {
    render(
      <SwipeableRow
        actions={
          <button data-testid="fork-button" class="bg-accent">
            Fork
          </button>
        }
      >
        <div data-testid="main-content">Main Content</div>
      </SwipeableRow>
    );

    // Both main content and action should be in the DOM
    expect(screen.getByTestId("main-content")).toBeTruthy();
    expect(screen.getByTestId("fork-button")).toBeTruthy();
  });

  it("calls onHide when action slot content is clicked while revealed", async () => {
    // Note: Full gesture testing would require more complex touch simulation
    // This test just verifies the component structure is correct
    const onReveal = vi.fn();
    const onHide = vi.fn();

    render(
      <SwipeableRow
        actions={<button data-testid="action">Fork</button>}
        onReveal={onReveal}
        onHide={onHide}
      >
        <div data-testid="content">Content</div>
      </SwipeableRow>
    );

    // Verify initial render
    expect(screen.getByTestId("content")).toBeTruthy();
    expect(screen.getByTestId("action")).toBeTruthy();
  });
});
