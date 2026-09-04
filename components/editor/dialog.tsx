"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import {
  Dialog as ShadcnDialog,
  DialogClose,
  DialogDescription as ShadcnDialogDescription,
  DialogHeader as ShadcnDialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle as ShadcnDialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Dialog pattern for the editor.
//
// Re-exports the shadcn Dialog primitive so future dialogs live in one place
// and project-wide modal styling (rounded-3xl, dark base surface) is
// consistent. Caller-supplied classNames still win via cn() merge.
//
// The underlying components in components/ui/ are protected foundation
// components — do not modify. Apply project styles here.
// ---------------------------------------------------------------------------

function Root(props: React.ComponentProps<typeof ShadcnDialog>) {
  return <ShadcnDialog {...props} />;
}

function Content({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  // The shadcn DialogContent has rounded-xl and bg-popover hardcoded inside
  // its className argument. We re-implement the same surface with project
  // defaults (rounded-3xl, bg-base) applied. Animation classes and
  // showCloseButton behavior are preserved.
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl bg-base p-4 text-sm text-copy-primary ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 [&>*]:min-w-0",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="absolute top-2 right-2" size="icon-sm">
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function Header({ className, ...props }: React.ComponentProps<"div">) {
  return <ShadcnDialogHeader className={cn(className)} {...props} />;
}

function Title({ className, ...props }: React.ComponentProps<typeof ShadcnDialogTitle>) {
  return <ShadcnDialogTitle className={cn(className)} {...props} />;
}

function Description({
  className,
  ...props
}: React.ComponentProps<typeof ShadcnDialogDescription>) {
  return <ShadcnDialogDescription className={cn(className)} {...props} />;
}

function Footer({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  // Same layout as the shadcn DialogFooter, with rounded-b-3xl to match
  // the Content's rounded-3xl and the project border token.
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-3xl border-t border-surface-border bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

export const EditorDialog = {
  Root,
  Trigger: DialogTrigger,
  Content,
  Close: DialogClose,
  Header,
  Title,
  Description,
  Footer,
};
