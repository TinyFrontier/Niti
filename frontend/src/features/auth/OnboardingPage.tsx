import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { completeOnboarding, getMe, updateMe, type UserRole } from "@/features/auth/api";
import { RoleStep } from "@/features/auth/onboarding/RoleStep";
import { SourceStep } from "@/features/auth/onboarding/SourceStep";
import {
  confirmCareerProfile,
  getCareerProfile,
  patchCareerProfile,
  EMPTY_PROFILE,
  type CareerProfileData,
  type ProfileDraft,
} from "@/features/career-profile/api";
import { LocationSection } from "@/features/career-profile/sections/LocationSection";
import { PreferencesSection } from "@/features/career-profile/sections/PreferencesSection";
import { RoleSection } from "@/features/career-profile/sections/RoleSection";
import { ThreadStepper, type ThreadStep } from "@/features/vacancies/ThreadStepper";
import { ApiError } from "@/shared/api/client";
import { BrandLogo } from "@/shared/ui/brand-logo";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ModeToggle } from "@/shared/ui/mode-toggle";
import { Skeleton } from "@/shared/ui/skeleton";

const STEP_LABELS = ["Role", "About you", "Experience", "Location", "Preferences"];

const HEADINGS: Record<number, { title: string; hint: string }> = {
  0: { title: "How are you going to use Niti?", hint: "This decides what the app shows you." },
  1: {
    title: "Let's start from what you already have",
    hint: "A CV, a few sentences, or neither — you can fill everything in by hand.",
  },
  2: { title: "Your role and experience", hint: "Check anything marked, then continue." },
  3: { title: "Where and how you want to work", hint: "This is what rules vacancies in or out." },
  4: { title: "Languages and deal breakers", hint: "The last step." },
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe });

  const { data: saved } = useQuery({ queryKey: ["career-profile"], queryFn: getCareerProfile });

  const [step, setStep] = useState(0);
  const [data, setData] = useState<CareerProfileData>(EMPTY_PROFILE);
  const [sources, setSources] = useState<ProfileDraft["sources"]>({});
  const [error, setError] = useState<string | null>(null);

  // Steps save as they go, so a wizard left half-finished resumes instead of
  // starting over: the role is already picked and the answers are on the server.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !user || !saved) return;
    resumed.current = true;
    if (!user.role) return;
    setData(saved.data);
    // past the source step once there are answers to come back to
    setStep(saved.updated_at ? 2 : 1);
  }, [user, saved]);

  const finish = async () => {
    await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    navigate("/", { replace: true });
  };

  const pickRole = useMutation({
    mutationFn: (role: UserRole) => updateMe({ role }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["auth", "me"], updated);
      // a recruiter has no profile to fill, so the backend already let them in
      if (updated.onboarding_completed_at) navigate("/", { replace: true });
      else setStep(1);
    },
  });

  const skip = useMutation({
    mutationFn: () => completeOnboarding(step),
    onSuccess: finish,
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<CareerProfileData>) => {
      await patchCareerProfile(patch);
      if (step === 4) {
        await confirmCareerProfile();
        await completeOnboarding();
      }
    },
    onSuccess: () => {
      setError(null);
      if (step === 4) void finish();
      else setStep(step + 1);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.detail : "Could not save. Try again."),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    );
  }
  if (user?.onboarding_completed_at) return <Navigate to="/" replace />;

  const steps: ThreadStep[] = STEP_LABELS.map((label, index) => ({
    label,
    state: index < step ? "done" : index === step ? "active" : "todo",
  }));
  const heading = HEADINGS[step];
  const busy = save.isPending || skip.isPending || pickRole.isPending;

  const sectionProps = {
    value: data,
    sources,
    onChange: (patch: Partial<CareerProfileData>) =>
      setData((current) => ({ ...current, ...patch })),
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-background p-6">
      <div className="absolute right-4 top-4">
        <ModeToggle />
      </div>
      <BrandLogo className="mb-6 mt-4 h-11" />

      <div className="w-full max-w-3xl">
        <ThreadStepper steps={steps} className="mb-8" />

        <h1 className="text-center text-2xl font-semibold tracking-tight">{heading.title}</h1>
        <p className="mt-1 text-center text-muted-foreground">{heading.hint}</p>

        <div className="mt-8">
          {step === 0 && <RoleStep onPick={pickRole.mutate} disabled={busy} />}

          {step > 0 && (
            <Card>
              <CardContent className="p-6">
                {step === 1 && (
                  <SourceStep
                    busy={busy}
                    onSkip={() => setStep(2)}
                    onDrafted={(draft) => {
                      setData(draft.data);
                      setSources(draft.sources);
                      setStep(2);
                    }}
                  />
                )}
                {step === 2 && <RoleSection {...sectionProps} />}
                {step === 3 && <LocationSection {...sectionProps} />}
                {step === 4 && <PreferencesSection {...sectionProps} />}

                {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

                {step > 1 && (
                  <div className="mt-6 flex items-center justify-between gap-2 border-t border-kumo-hairline pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(step - 1)}
                      disabled={busy}
                    >
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => skip.mutate()}
                        disabled={busy}
                      >
                        Finish later
                      </Button>
                      <Button type="button" onClick={() => save.mutate(data)} disabled={busy}>
                        {step === 4 ? "Save profile" : "Continue"}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {step === 1 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <button className="hover:underline" onClick={() => skip.mutate()} disabled={busy}>
              Skip for now
            </button>{" "}
            — you can fill the profile any time in Settings.
          </p>
        )}
      </div>
    </div>
  );
}
