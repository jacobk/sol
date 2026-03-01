import { useState } from "preact/hooks";
import { SessionList } from "./components/SessionList.js";
import { SessionDetail } from "./components/SessionDetail.js";

export function App() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  if (selectedSessionId) {
    return (
      <SessionDetail
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
      />
    );
  }

  return <SessionList onSelectSession={setSelectedSessionId} />;
}
