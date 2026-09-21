import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This page doesn't exist</EmptyTitle>
          <EmptyDescription>Check the address, or head back to the timeline.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link to="/" />} size="sm">
            Go to the timeline
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
