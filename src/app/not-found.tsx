import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <Link href="/jobs" className="btn-primary">
        ← /jobs
      </Link>
    </div>
  );
}
