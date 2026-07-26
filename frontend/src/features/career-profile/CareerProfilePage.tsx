import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import {
  confirmCareerProfile,
  getCareerProfile,
  putCareerProfile,
  EMPTY_PROFILE,
  type CareerProfileData,
} from "@/features/career-profile/api";
import { LocationSection } from "@/features/career-profile/sections/LocationSection";
import { PreferencesSection } from "@/features/career-profile/sections/PreferencesSection";
import { RoleSection } from "@/features/career-profile/sections/RoleSection";
import { ApiError } from "@/shared/api/client";
import { PageHeader } from "@/shared/layout/PageHeader";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

export function CareerProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["career-profile"],
    queryFn: getCareerProfile,
  });

  const [data, setData] = useState<CareerProfileData>(EMPTY_PROFILE);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // adopt the server copy until the user starts editing, so a refetch never
  // overwrites work in progress
  useEffect(() => {
    if (profile && !dirty) setData(profile.data);
  }, [profile, dirty]);

  const save = useMutation({
    mutationFn: async () => {
      const saved = await putCareerProfile(data);
      // saving from this page is an act of confirmation in itself
      return profile?.confirmed_at ? saved : await confirmCareerProfile();
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["career-profile"], saved);
      setDirty(false);
      setError(null);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.detail : "Could not save. Try again."),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const sectionProps = {
    value: data,
    // nothing on this page is an unconfirmed AI proposal: the wizard owns that
    sources: {},
    onChange: (patch: Partial<CareerProfileData>) => {
      setDirty(true);
      setData((current) => ({ ...current, ...patch }));
    },
  };

  const missing = profile?.missing_for_matching ?? [];

  return (
    <div className="max-w-3xl pb-24">
      <PageHeader
        title="Career profile"
        description="What Niti compares vacancies against"
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-kumo-recessed">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${profile?.completeness ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-medium">{profile?.completeness ?? 0}% complete</span>
          </div>
          {profile?.is_ready_for_matching ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="size-4" /> Ready for job matching
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Still needed: {missing.join(", ")}
            </span>
          )}
        </CardContent>
      </Card>

      {[
        { title: "Role and experience", node: <RoleSection {...sectionProps} /> },
        { title: "Location, format and pay", node: <LocationSection {...sectionProps} /> },
        { title: "Languages and preferences", node: <PreferencesSection {...sectionProps} /> },
      ].map((section) => (
        <Card key={section.title} className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>{section.node}</CardContent>
        </Card>
      ))}

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      <div className="sticky bottom-4 flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 shadow-overlay">
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? "Saving..." : "Save changes"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {dirty ? "Unsaved changes" : "Everything is saved"}
        </span>
      </div>
    </div>
  );
}
