import type { ComponentChildren, JSX } from "preact";
import { Dialog as HeadlessDialog, DialogPanel, DialogTitle, Transition, TransitionChild } from "@headlessui/react";
import { Fragment } from "preact";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ComponentChildren;
  class?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  class: className = "",
}: BottomSheetProps): JSX.Element {
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

        {/* Sheet */}
        <div class="fixed inset-0 flex items-end">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="translate-y-full"
            enterTo="translate-y-0"
            leave="ease-in duration-200"
            leaveFrom="translate-y-0"
            leaveTo="translate-y-full"
          >
            <DialogPanel
              class={`
                w-full rounded-t-2xl bg-surface-2
                pb-[env(safe-area-inset-bottom)]
                shadow-xl max-h-[85dvh] overflow-y-auto
                ${className}
              `}
            >
              {/* Drag handle */}
              <div class="flex justify-center pt-3 pb-2">
                <div class="w-10 h-1 rounded-full bg-text-muted/30" />
              </div>

              <div class="px-6 pb-6">
                {title && (
                  <DialogTitle class="text-lg font-bold text-text-primary mb-4">
                    {title}
                  </DialogTitle>
                )}
                {children}
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </HeadlessDialog>
    </Transition>
  );
}
