import { useState } from "preact/hooks";
import { SessionList } from "./components/SessionList.js";
import { SessionDetail } from "./components/SessionDetail.js";
import { Search } from "./components/Search.js";

type View = "list" | "search" | "detail";

export function App() {
  const [view, setView] = useState<View>("list");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (view === "detail" && selectedSessionId) {
    return (
      <SessionDetail
        sessionId={selectedSessionId}
        searchQuery={searchQuery || undefined}
        onBack={() => {
          setSelectedSessionId(null);
          setSearchQuery("");
          setView(searchQuery ? "search" : "list");
        }}
      />
    );
  }

  if (view === "search") {
    return (
      <Search
        onSelectSession={(id, query) => {
          setSelectedSessionId(id);
          setSearchQuery(query);
          setView("detail");
        }}
        onBack={() => {
          setSearchQuery("");
          setView("list");
        }}
      />
    );
  }

  return (
    <SessionList
      onSelectSession={(id) => {
        setSelectedSessionId(id);
        setSearchQuery("");
        setView("detail");
      }}
      onOpenSearch={() => setView("search")}
    />
  );
}
