import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Check, Layers, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getMe, updateMe, type UserRole } from "@/features/auth/api";
import { PageHeader } from "@/shared/layout/PageHeader";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const ROLE_OPTIONS: Array<{ role: UserRole; icon: LucideIcon; title: string; hint: string }> = [
  { role: "job_seeker", icon: Briefcase, title: "Job Seeker", hint: "Vacancies, applications, CVs" },
  { role: "recruiter", icon: Users, title: "Recruiter", hint: "Contacts CRM and follow-ups" },
  { role: "mix", icon: Layers, title: "Mix", hint: "Everything enabled" },
];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });
  const [fullName, setFullName] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateMe,
    onSuccess: (updated) => {
      queryClient.setQueryData(["auth", "me"], updated);
    },
  });

  const displayName = fullName ?? user?.full_name ?? "";

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate({ full_name: displayName.trim() || null });
            }}
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                value={displayName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Role</CardTitle>
          <CardDescription>Controls which sections are shown in the sidebar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {ROLE_OPTIONS.map(({ role, icon: Icon, title, hint }) => {
              const active = user?.role === role;
              return (
                <button
                  key={role}
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ role })}
                  className={cn(
                    "relative flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted/50",
                  )}
                >
                  {active && <Check className="absolute right-3 top-3 size-4 text-primary" />}
                  <Icon className={cn("size-5", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
