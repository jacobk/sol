import {
  SessionManager,
  type SessionInfo,
  type SessionHeader,
  type SessionEntry,
} from "@mariozechner/pi-coding-agent";
import { extractPlainText, truncatePreview } from "./content.js";

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

/** Local mirror of SDK's SessionTreeNode (not exported from package root) */
interface SessionTreeNode {
  entry: SessionEntry;
  children: SessionTreeNode[];
  label?: string;
}

/** Serialized tree node for the /api/tree/:id endpoint */
export interface TreeNodeResponse {
  id: string;
  parentId: string | null;
  type: string;
  role: string | null;
  timestamp: string;
  preview: string;
  childCount: number;
  children: TreeNodeResponse[];
}

export interface SessionTreeResponse {
  header: SessionHeader | null;
  tree: TreeNodeResponse[];
}

/**
 * Extract a short preview string from a session entry.
 * Uses shared content extraction utility (mirrors frontend's content.ts).
 */
function extractEntryPreview(entry: SessionEntry): string {
  switch (entry.type) {
    case "message": {
      const msg = entry.message as unknown as Record<string, unknown>;
      const role = (msg.role as string) ?? "";
      if (role === "user" || role === "assistant" || role === "custom") {
        return truncatePreview(extractPlainText(msg.content as unknown[] | string));
      }
      if (role === "toolResult") {
        const toolName = (msg.toolName as string) ?? "tool";
        const text = truncatePreview(extractPlainText(msg.content as unknown[] | string));
        return text ? `${toolName}: ${text}` : toolName;
      }
      if (role === "bashExecution") {
        return truncatePreview(`$ ${msg.command as string}`);
      }
      if (role === "compactionSummary") {
        return truncatePreview((msg.summary as string) ?? "");
      }
      if (role === "branchSummary") {
        return truncatePreview((msg.summary as string) ?? "");
      }
      return "";
    }
    case "compaction":
      return truncatePreview(entry.summary);
    case "branch_summary":
      return truncatePreview(entry.summary);
    case "custom_message":
      return truncatePreview(extractPlainText(
        entry.content as unknown[] | string | undefined
      ));
    default:
      return "";
  }
}

/**
 * Get the role string from a session entry.
 */
function getEntryRole(entry: SessionEntry): string | null {
  if (entry.type === "message") {
    const msg = entry.message as unknown as Record<string, unknown>;
    return (msg.role as string) ?? null;
  }
  return null;
}

/**
 * Serialize a SessionTreeNode to our API response format.
 */
function serializeTreeNode(node: SessionTreeNode): TreeNodeResponse {
  return {
    id: node.entry.id,
    parentId: node.entry.parentId,
    type: node.entry.type,
    role: getEntryRole(node.entry),
    timestamp: node.entry.timestamp,
    preview: extractEntryPreview(node.entry),
    childCount: node.children.length,
    children: node.children.map(serializeTreeNode),
  };
}

/**
 * Get the full tree structure for a session by its UUID.
 * Returns null if no session matches the given ID.
 */
export async function getSessionTree(
  id: string
): Promise<SessionTreeResponse | null> {
  const allSessions = await SessionManager.listAll();
  const match = allSessions.find((s) => s.id === id);

  if (!match) {
    return null;
  }

  const sm = SessionManager.open(match.path);
  const header = sm.getHeader();
  const tree = sm.getTree();

  return {
    header,
    tree: tree.map(serializeTreeNode),
  };
}

/**
 * Get a specific branch (path from root to a given leaf) for a session.
 * Returns null if no session matches the given ID.
 */
export async function getSessionBranch(
  id: string,
  leafId?: string
): Promise<SessionDetailResponse | null> {
  const allSessions = await SessionManager.listAll();
  const match = allSessions.find((s) => s.id === id);

  if (!match) {
    return null;
  }

  const sm = SessionManager.open(match.path);
  const header = sm.getHeader();
  const entries = sm.getBranch(leafId);

  return { header, entries };
}
