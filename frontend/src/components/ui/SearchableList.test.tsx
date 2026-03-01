import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/preact";
import { SearchableList } from "./SearchableList.js";

describe("SearchableList", () => {
  const mockItems = [
    { id: "1", label: "Apple", description: "A fruit" },
    { id: "2", label: "Banana", description: "Yellow fruit" },
    { id: "3", label: "Cherry", description: "Red fruit" },
  ];

  it("renders all items initially", () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <SearchableList items={mockItems} onSelect={onSelect} />
    );

    expect(getByText("Apple")).toBeTruthy();
    expect(getByText("Banana")).toBeTruthy();
    expect(getByText("Cherry")).toBeTruthy();
  });

  it("filters items based on search query", () => {
    const onSelect = vi.fn();
    const { getByPlaceholderText, queryByText, getByText } = render(
      <SearchableList items={mockItems} onSelect={onSelect} placeholder="Search…" />
    );

    const input = getByPlaceholderText("Search…");
    fireEvent.input(input, { target: { value: "ban" } });

    expect(getByText("Banana")).toBeTruthy();
    expect(queryByText("Apple")).toBeNull();
    expect(queryByText("Cherry")).toBeNull();
  });

  it("filters by description", () => {
    const onSelect = vi.fn();
    const { getByPlaceholderText, queryByText, getByText } = render(
      <SearchableList items={mockItems} onSelect={onSelect} placeholder="Search…" />
    );

    const input = getByPlaceholderText("Search…");
    fireEvent.input(input, { target: { value: "yellow" } });

    expect(getByText("Banana")).toBeTruthy();
    expect(queryByText("Apple")).toBeNull();
  });

  it("shows empty message when no items match", () => {
    const onSelect = vi.fn();
    const { getByPlaceholderText, getByText } = render(
      <SearchableList
        items={mockItems}
        onSelect={onSelect}
        placeholder="Search…"
        emptyMessage="No results"
      />
    );

    const input = getByPlaceholderText("Search…");
    fireEvent.input(input, { target: { value: "xyz" } });

    expect(getByText("No results")).toBeTruthy();
  });

  it("calls onSelect when item is clicked", () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <SearchableList items={mockItems} onSelect={onSelect} />
    );

    fireEvent.click(getByText("Banana"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(mockItems[1]);
  });

  it("shows secondary text when provided", () => {
    const onSelect = vi.fn();
    const itemsWithSecondary = [
      { id: "1", label: "File", secondary: "src/app.ts" },
    ];
    const { getByText } = render(
      <SearchableList items={itemsWithSecondary} onSelect={onSelect} />
    );

    expect(getByText("src/app.ts")).toBeTruthy();
  });
});
