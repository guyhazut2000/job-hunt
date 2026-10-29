"use client";

import { useState, useTransition } from "react";
import { Bell, BellRing } from "lucide-react";
import { setCompanyFollow } from "@/app/notification-actions";
import { Button } from "@/components/ui/button";

interface Labels {
  follow: string;
  following: string;
  unfollow: string;
  hint: string;
  limit: string;
}

/** "Follow" on a company page: alerts (COMPANY_JOBS) when it publishes new jobs. */
export function FollowCompanyButton({
  companyId,
  initial,
  labels,
}: {
  companyId: string;
  initial: boolean;
  labels: Labels;
}) {
  const [following, setFollowing] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const next = !following;
      const res = await setCompanyFollow(companyId, next);
      setFollowing(res.following);
      setError(res.error === "limit" ? labels.limit : null);
    });
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={following ? "secondary" : "outline"}
        size="sm"
        className="min-h-11"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        title={following ? labels.unfollow : labels.hint}
        data-follow-company
      >
        {following ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
        {following ? labels.following : labels.follow}
      </Button>
      {error && (
        <span className="text-destructive text-xs" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
