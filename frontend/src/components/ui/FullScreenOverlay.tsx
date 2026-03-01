import type { ComponentChildren, JSX } from "preact";
import { Dialog as HeadlessDialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react";
import { Fragment } from "preact";

interface FullScreenOverlayProps {
  open: boolean;
  onClose: () => void;
  children: ComponentChildren;
  class?: string;
}

/**
 * Full-screen modal overlay with safe area insets.
 * Used for intensive editing experiences like the Mobile Composer.
 * 
 * Unlike BottomSheet, this takes the full viewport to maximize editing space
 * and avoid conflicts with the iOS keyboard.
 */
export function FullScreenOverlay({
  open,
  onClose,
  children,
  class: className = "",
}: FullScreenOverlayProps): JSX.Element {
  return (
    <Transition show={open} as={Fragment}>
      <HeadlessDialog onClose={onClose} class="relative z-50">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div class="fixed inset-0 bg-black/80" />
        </TransitionChild>

        {/* Full-screen panel */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0 translate-y-4"
          enterTo="opacity-100 translate-y-0"
          leave="ease-in duration-200"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-4"
        >
          <DialogPanel
            class={`
              fixed inset-0 bg-bg-app
              pt-[env(safe-area-inset-top)]
              pb-[env(safe-area-inset-bottom)]
              pl-[env(safe-area-inset-left)]
              pr-[env(safe-area-inset-right)]
              flex flex-col
              ${className}
            `}
          >
            {children}
          </DialogPanel>
        </TransitionChild>
      </HeadlessDialog>
    </Transition>
  );
}
