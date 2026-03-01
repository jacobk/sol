import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/preact";

// Mock the BottomSheet to avoid Headless UI Dialog issues in tests
vi.mock("./ui/index.js", async () => {
  const actual = await vi.importActual("./ui/index.js");
  return {
    ...actual,
    BottomSheet: ({ open, children, title }: { open: boolean; children: unknown; title?: string }) => {
      if (!open) return null;
      return (
        <div data-testid="mock-bottomsheet">
          {title && <div data-testid="sheet-title">{title}</div>}
          {children}
        </div>
      );
    },
  };
});

import { ForkActionSheet } from "./ForkActionSheet.js";

describe("ForkActionSheet", () => {
  it("renders fork button and cancel button when open", () => {
    render(
      <ForkActionSheet
        open={true}
        onClose={() => {}}
        entryId="test-entry"
        onFork={() => {}}
      />
    );

    expect(screen.getByText("Fork from this message")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("renders title", () => {
    render(
      <ForkActionSheet
        open={true}
        onClose={() => {}}
        entryId="test-entry"
        onFork={() => {}}
      />
    );

    expect(screen.getByTestId("sheet-title").textContent).toBe("Fork Session");
  });

  it("renders explanation text", () => {
    render(
      <ForkActionSheet
        open={true}
        onClose={() => {}}
        entryId="test-entry"
        onFork={() => {}}
      />
    );

    expect(screen.getByText(/Create a new branch from this message/)).toBeTruthy();
  });

  it("calls onFork when fork button is clicked", () => {
    const onFork = vi.fn();
    render(
      <ForkActionSheet
        open={true}
        onClose={() => {}}
        entryId="test-entry"
        onFork={onFork}
      />
    );

    fireEvent.click(screen.getByText("Fork from this message"));
    expect(onFork).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ForkActionSheet
        open={true}
        onClose={onClose}
        entryId="test-entry"
        onFork={() => {}}
      />
    );

    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables buttons when loading", () => {
    render(
      <ForkActionSheet
        open={true}
        onClose={() => {}}
        entryId="test-entry"
        onFork={() => {}}
        loading={true}
      />
    );

    // When loading, the fork button shows a spinner instead of text
    // Cancel button should still show text but be disabled
    const cancelButton = screen.getByText("Cancel").closest("button") as HTMLButtonElement | null;
    expect(cancelButton?.disabled).toBe(true);

    // Find all buttons and check that the primary one (first) is disabled
    const buttons = screen.getAllByRole("button") as HTMLButtonElement[];
    expect(buttons[0]?.disabled).toBe(true); // Fork button (shows spinner)
    expect(buttons[1]?.disabled).toBe(true); // Cancel button
  });

  it("does not render when closed", () => {
    render(
      <ForkActionSheet
        open={false}
        onClose={() => {}}
        entryId="test-entry"
        onFork={() => {}}
      />
    );

    expect(screen.queryByTestId("mock-bottomsheet")).toBeNull();
  });
});
