"use client";

import "sonner/dist/styles.css";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster as Sonner } from "sonner";
import type { ComponentProps } from "react";

type SonnerProps = ComponentProps<typeof Sonner>;

export function Toaster(props: SonnerProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const theme =
    resolvedTheme === "dark" || resolvedTheme === "light"
      ? resolvedTheme
      : "system";

  const node = (
    <Sonner
      theme={theme}
      className="toaster group"
      richColors
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );

  if (!mounted) return null;
  return createPortal(node, document.body);
}
