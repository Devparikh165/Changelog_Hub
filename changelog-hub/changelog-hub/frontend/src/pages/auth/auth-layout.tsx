import type { ReactNode } from "react";
import { Wordmark } from "@/components/app/site-header";
import { Card, CardDescription, CardHeader, CardPanel, CardTitle } from "@/components/ui/card";

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center px-4 py-12">
      <Wordmark className="mb-8" />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardPanel>{children}</CardPanel>
      </Card>
      {footer && <div className="mt-6 text-center text-muted-foreground text-sm">{footer}</div>}
    </div>
  );
}

export function TextLink({ children, ...props }: React.ComponentProps<"a">) {
  return (
    <a className="font-medium text-foreground underline-offset-4 hover:underline" {...props}>
      {children}
    </a>
  );
}
