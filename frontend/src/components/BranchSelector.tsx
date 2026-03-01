import type { JSX } from "preact";
import { Badge, Body, BottomSheet, Metadata } from "./ui/index.js";

/** A branch option representing a child path from a branch point */
export interface BranchOption {
  /** ID of the child entry that starts this branch */
  childId: string;
  /** Preview text of the first message on this branch */
  preview: string;
  /** Total message count along this branch (depth to leaf) */
  depth: number;
  /** Preview of the leaf entry on this branch */
  leafPreview: string;
  /** Whether this is the currently displayed branch */
  isActive: boolean;
}

interface BranchSelectorProps {
  open: boolean;
  onClose: () => void;
  branches: BranchOption[];
  onSelectBranch: (childId: string) => void;
}

/**
 * BottomSheet that shows sibling branches at a branch point.
 * Each option shows the first message preview, depth, and leaf preview.
 */
export function BranchSelector({
  open,
  onClose,
  branches,
  onSelectBranch,
}: BranchSelectorProps): JSX.Element {
  return (
    <BottomSheet open={open} onClose={onClose} title={`${branches.length} Branches`}>
      <div class="flex flex-col gap-2">
        {branches.map((branch) => (
          <button
            key={branch.childId}
            type="button"
            onClick={() => {
              onSelectBranch(branch.childId);
              onClose();
            }}
            class={`
              w-full text-left rounded-lg px-4 py-3
              min-h-[var(--spacing-touch)]
              transition-colors duration-100
              ${branch.isActive
                ? "bg-accent/15 border border-accent/40"
                : "bg-surface active:bg-surface-2 border border-transparent"
              }
            `}
          >
            <div class="flex items-center gap-2 mb-1">
              {branch.isActive && (
                <Badge variant="accent">Current</Badge>
              )}
              <Metadata>{branch.depth} messages</Metadata>
            </div>
            <Body class="text-text-primary line-clamp-2 text-sm">
              {branch.preview || "…"}
            </Body>
            {branch.leafPreview && (
              <Metadata class="mt-1 line-clamp-1 block">
                Ends: {branch.leafPreview}
              </Metadata>
            )}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

/** Props for the tree overview */
export interface TreeBranch {
  /** Leaf ID to navigate to this branch */
  leafId: string;
  /** Description of the path (e.g., "User → Assistant → …") */
  pathDescription: string;
  /** Number of messages on this branch */
  messageCount: number;
  /** Preview of the leaf entry */
  leafPreview: string;
  /** Whether this is the current branch */
  isActive: boolean;
}

interface TreeOverviewProps {
  open: boolean;
  onClose: () => void;
  branches: TreeBranch[];
  onSelectBranch: (leafId: string) => void;
}

/**
 * BottomSheet showing a compact summary of all branches in the tree.
 */
export function TreeOverview({
  open,
  onClose,
  branches,
  onSelectBranch,
}: TreeOverviewProps): JSX.Element {
  return (
    <BottomSheet open={open} onClose={onClose} title="All Branches">
      <div class="flex flex-col gap-2">
        {branches.length === 0 && (
          <Metadata class="text-center py-4">No branches — linear session</Metadata>
        )}
        {branches.map((branch, i) => (
          <button
            key={branch.leafId}
            type="button"
            onClick={() => {
              onSelectBranch(branch.leafId);
              onClose();
            }}
            class={`
              w-full text-left rounded-lg px-4 py-3
              min-h-[var(--spacing-touch)]
              transition-colors duration-100
              ${branch.isActive
                ? "bg-accent/15 border border-accent/40"
                : "bg-surface active:bg-surface-2 border border-transparent"
              }
            `}
          >
            <div class="flex items-center gap-2 mb-1">
              <Badge variant="default">Branch {i + 1}</Badge>
              {branch.isActive && (
                <Badge variant="accent">Current</Badge>
              )}
              <Metadata>{branch.messageCount} messages</Metadata>
            </div>
            <Body class="text-text-primary line-clamp-2 text-sm">
              {branch.pathDescription || "…"}
            </Body>
            {branch.leafPreview && (
              <Metadata class="mt-1 line-clamp-1 block">
                Ends: {branch.leafPreview}
              </Metadata>
            )}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
