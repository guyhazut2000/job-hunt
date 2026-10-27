import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <p className="kicker">404</p>
      <h1 className="text-display font-black">∅</h1>
      <Button asChild>
        <Link href="/jobs">/jobs</Link>
      </Button>
    </div>
  );
}
