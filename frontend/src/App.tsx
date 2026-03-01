import { useState } from "preact/hooks";
import { SessionList } from "./components/SessionList.js";
import { SessionDetail } from "./components/SessionDetail.js";
import { Search } from "./components/Search.js";
import { FileList } from "./components/FileList.js";
import { FileViewer } from "./components/FileViewer.js";
import { DiffViewer } from "./components/DiffViewer.js";

type View = "list" | "search" | "detail" | "files" | "file-viewer" | "diff-viewer";

export function App() {
  const [view, setView] = useState<View>("list");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");

  if (view === "diff-viewer" && selectedSessionId && selectedFilePath) {
    return (
      <DiffViewer
        sessionId={selectedSessionId}
        filePath={selectedFilePath}
        onBack={() => {
          setSelectedFilePath("");
          setView("files");
        }}
      />
    );
  }

  if (view === "file-viewer" && selectedSessionId && selectedFilePath) {
    return (
      <FileViewer
        sessionId={selectedSessionId}
        filePath={selectedFilePath}
        onBack={() => {
          setSelectedFilePath("");
          setView("files");
        }}
      />
    );
  }

  if (view === "files" && selectedSessionId) {
    return (
      <FileList
        sessionId={selectedSessionId}
        onBack={() => setView("detail")}
        onSelectFile={(filePath) => {
          setSelectedFilePath(filePath);
          setView("file-viewer");
        }}
        onSelectDiff={(filePath) => {
          setSelectedFilePath(filePath);
          setView("diff-viewer");
        }}
      />
    );
  }

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
        onOpenFiles={() => setView("files")}
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
