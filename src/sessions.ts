import {
  SessionManager,
  type SessionInfo,
  type SessionHeader,
  type SessionEntry,
} from "@mariozechner/pi-coding-agent";

export interface SessionResponse {
  path: string;
  id: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
}

export interface GroupedSessions {
  project: string;
  sessions: SessionResponse[];
}

function toSessionResponse(info: SessionInfo): SessionResponse {
  return {
    path: info.path,
    id: info.id,
    cwd: info.cwd,
    name: info.name,
    created: info.created.toISOString(),
    modified: info.modified.toISOString(),
    messageCount: info.messageCount,
    firstMessage: info.firstMessage,
  };
}

/**
 * List all sessions, grouped by project directory.
 * Sessions within each group are sorted by modified descending.
 * Groups are sorted by the most recent session's modified timestamp descending.
 */
export async function listGroupedSessions(): Promise<GroupedSessions[]> {
  const allSessions = await SessionManager.listAll();

  // Sort all sessions by modified descending
  allSessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());

  // Group by cwd (project directory)
  const groups = new Map<string, SessionResponse[]>();

  for (const session of allSessions) {
    const project = session.cwd || "Unknown Project";
    const existing = groups.get(project);
    const response = toSessionResponse(session);

    if (existing) {
      existing.push(response);
    } else {
      groups.set(project, [response]);
    }
  }

  // Convert to array, sorted by most recent session in each group
  const result: GroupedSessions[] = [];
  for (const [project, sessions] of groups) {
    result.push({ project, sessions });
  }

  // Groups are already sorted because we inserted sessions in modified-desc order
  // The first session in each group is the most recent
  result.sort((a, b) => {
    const aTime = new Date(a.sessions[0].modified).getTime();
    const bTime = new Date(b.sessions[0].modified).getTime();
    return bTime - aTime;
  });

  return result;
}

export interface SessionDetailResponse {
  header: SessionHeader | null;
  entries: SessionEntry[];
}

/**
 * Find a session by its UUID and return the current branch entries plus header.
 * Returns null if no session matches the given ID.
 */
export async function getSessionById(
  id: string
): Promise<SessionDetailResponse | null> {
  const allSessions = await SessionManager.listAll();
  const match = allSessions.find((s) => s.id === id);

  if (!match) {
    return null;
  }

  const sm = SessionManager.open(match.path);
  const header = sm.getHeader();
  const entries = sm.getBranch();

  return { header, entries };
}
