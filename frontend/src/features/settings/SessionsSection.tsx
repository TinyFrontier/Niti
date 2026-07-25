import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { X } from "lucide-react";
import { listSessions, logoutAll, revokeSession, type SessionOut } from "@/features/auth/api";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

const BROWSERS: Array<[RegExp, string]> = [
  [/edg(?:e|a|ios)?\//i, "Edge"],
  [/opr\/|opera/i, "Opera"],
  [/firefox|fxios/i, "Firefox"],
  [/chrome|crios/i, "Chrome"],
  [/safari/i, "Safari"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/iphone|ipad|ios/i, "iOS"],
  [/android/i, "Android"],
  [/windows/i, "Windows"],
  [/mac os x|macintosh/i, "macOS"],
  [/linux/i, "Linux"],
];

function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  if (browser) return browser;
  if (system) return system;
  return userAgent.length > 60 ? `${userAgent.slice(0, 57)}...` : userAgent;
}

function relative(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function SessionRow({
  session,
  onRevoke,
  revoking,
}: {
  session: SessionOut;
  onRevoke: (id: string) => void;
  revoking: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-kumo-strong">
            {describeUserAgent(session.user_agent)}
          </p>
          {session.current && <Badge variant="success">Current</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in {relative(session.created_at)} · last active {relative(session.last_used_at)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Revoke session (${describeUserAgent(session.user_agent)})`}
        title="Revoke session"
        disabled={session.current || revoking}
        onClick={() => onRevoke(session.id)}
      >
        <X />
      </Button>
    </li>
  );
}

export function SessionsSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: sessions, isPending, isError } = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: listSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: logoutAll,
    onSettled: () => {
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">Active sessions</CardTitle>
        <CardDescription>Devices where you are currently signed in.</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : isError ? (
          <p className="text-sm text-destructive">Could not load sessions.</p>
        ) : (
          <>
            <ul className="divide-y divide-kumo-hairline">
              {sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  onRevoke={(id) => revokeMutation.mutate(id)}
                  revoking={revokeMutation.isPending}
                />
              ))}
            </ul>
            <div className="mt-4">
              <Button
                variant="outline"
                className="text-destructive"
                disabled={logoutAllMutation.isPending}
                onClick={() => logoutAllMutation.mutate()}
              >
                {logoutAllMutation.isPending ? "Logging out..." : "Log out everywhere"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
