import type { ComponentChildren, JSX } from "preact";
import { Dialog as HeadlessDialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { Fragment } from "preact";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ComponentChildren;
  class?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  class: className = "",
}: DialogProps): JSX.Element {
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
          <div class="fixed inset-0 bg-black/60" />
        </TransitionChild>

        {/* Panel */}
        <div class="fixed inset-0 flex items-end sm:items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel
              class={`
                w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl
                bg-surface-2 p-6
                shadow-xl
                ${className}
              `}
            >
              {title && (
                <DialogTitle class="text-lg font-bold text-text-primary mb-4">
                  {title}
                </DialogTitle>
              )}
              {children}
            </DialogPanel>
          </TransitionChild>
        </div>
      </HeadlessDialog>
    </Transition>
  );
}
