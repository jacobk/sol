import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/preact";
import { usePromptState } from "./usePromptState.js";

describe("usePromptState", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("initializes with empty text and prompt mode", () => {
    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    expect(result.current.text).toBe("");
    expect(result.current.mode).toBe("prompt");
    expect(result.current.sendState).toBe("idle");
    expect(result.current.canSend).toBe(false);
  });

  it("updates text when setText is called", () => {
    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setText("Hello world");
    });

    expect(result.current.text).toBe("Hello world");
    expect(result.current.canSend).toBe(true);
  });

  it("canSend is false for whitespace-only text", () => {
    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setText("   ");
    });

    expect(result.current.canSend).toBe(false);
  });

  it("updates mode when setMode is called", () => {
    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setMode("steer");
    });

    expect(result.current.mode).toBe("steer");
  });

  it("clears text and resets mode when clear is called", () => {
    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setText("Hello");
      result.current.setMode("steer");
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.text).toBe("");
    expect(result.current.mode).toBe("prompt");
  });

  it("sends prompt to correct endpoint", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setText("Test message");
    });

    await act(async () => {
      await result.current.sendPrompt();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/session/sess-1/prompt",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ message: "Test message" }),
      })
    );
  });

  it("clears text after successful send", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setText("Test message");
    });

    await act(async () => {
      await result.current.sendPrompt();
    });

    expect(result.current.text).toBe("");
  });

  it("calls onPromptSent callback after successful send", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    const onPromptSent = vi.fn();

    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1", onPromptSent })
    );

    act(() => {
      result.current.setText("Test message");
    });

    await act(async () => {
      await result.current.sendPrompt();
    });

    expect(onPromptSent).toHaveBeenCalled();
  });

  it("sends to steer endpoint when mode is steer", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setText("Steer message");
      result.current.setMode("steer");
    });

    await act(async () => {
      await result.current.sendPrompt();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/session/sess-1/steer",
      expect.anything()
    );
  });

  it("resets mode to prompt after sending steer", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setText("Steer message");
      result.current.setMode("steer");
    });

    await act(async () => {
      await result.current.sendPrompt();
    });

    expect(result.current.mode).toBe("prompt");
  });

  it("sets error state on failed send", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not connected" }),
    });

    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    act(() => {
      result.current.setText("Test message");
    });

    await act(async () => {
      await result.current.sendPrompt();
    });

    expect(result.current.sendState).toBe("error");
  });

  it("does not send empty prompts", async () => {
    const { result } = renderHook(() =>
      usePromptState({ sessionId: "sess-1" })
    );

    await act(async () => {
      await result.current.sendPrompt();
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
