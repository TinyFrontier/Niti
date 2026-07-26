import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { login } from "@/features/auth/api";
import { API_URL, ApiError } from "@/shared/api/client";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { BrandLogo } from "@/shared/ui/brand-logo";
import { ModeToggle } from "@/shared/ui/mode-toggle";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const OAUTH_ERRORS: Record<string, string> = {
  oauth_cancelled: "Google sign-in was cancelled.",
  oauth_failed: "Google sign-in failed. Please try again.",
  oauth_email_unverified: "Your Google email address is not verified.",
};

const STORY_STEPS = [
  { label: "Vacancy", detail: "Frontend Engineer" },
  { label: "Applied", detail: "Application sent" },
  { label: "Interview", detail: "Technical interview" },
  { label: "Offer", detail: "Offer received" },
] as const;

function ThreadStoryline() {
  return (
    <div className="auth-storyline">
      <svg
        className="auth-thread-artwork"
        viewBox="0 0 760 170"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="auth-thread-track"
          d="M-24 32C18 27 38 80 72 91C116 106 154 48 210 61C274 76 292 130 356 124C417 118 423 55 486 50C543 46 566 101 625 93C681 85 711 49 784 61"
        />
        <path
          className="auth-thread-line"
          d="M-24 32C18 27 38 80 72 91C116 106 154 48 210 61C274 76 292 130 356 124C417 118 423 55 486 50C543 46 566 101 625 93C681 85 711 49 784 61"
        />

        <g className="auth-thread-stage auth-thread-stage-1">
          <circle className="auth-thread-vacancy-glow" cx="72" cy="91" r="18" />
          <circle className="auth-thread-node auth-thread-node-vacancy" cx="72" cy="91" r="7" />
          <circle className="auth-thread-node-dot" cx="72" cy="91" r="2.5" />
        </g>
        <g className="auth-thread-stage auth-thread-stage-2">
          <circle className="auth-thread-node" cx="210" cy="61" r="8" />
          <circle className="auth-thread-node-dot" cx="210" cy="61" r="2.5" />
        </g>
        <g className="auth-thread-stage auth-thread-stage-3">
          <circle className="auth-thread-node auth-thread-node-interview" cx="486" cy="50" r="10" />
          <circle className="auth-thread-node-dot" cx="486" cy="50" r="3" />
        </g>
        <g className="auth-thread-stage auth-thread-stage-4">
          <circle className="auth-thread-offer-glow" cx="625" cy="93" r="20" />
          <circle className="auth-thread-node auth-thread-node-offer" cx="625" cy="93" r="9" />
          <circle className="auth-thread-node-dot" cx="625" cy="93" r="3" />
        </g>
      </svg>

      <div className="auth-thread-labels" aria-hidden="true">
        {STORY_STEPS.map((step, index) => (
          <div key={step.label} className={`auth-thread-label auth-thread-label-${index + 1}`}>
            <strong>{step.label}</strong>
            <span>{step.detail}</span>
          </div>
        ))}
      </div>

      <ol className="sr-only">
        {STORY_STEPS.map((step) => (
          <li key={step.label}>
            {step.label}: {step.detail}
          </li>
        ))}
      </ol>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path
        fill="#4285F4"
        d="M21.35 12.2c0-.64-.06-1.25-.16-1.84H12v3.48h5.25a4.49 4.49 0 0 1-1.95 2.94v2.26h3.16c1.85-1.7 2.89-4.22 2.89-6.84Z"
      />
      <path
        fill="#34A853"
        d="M12 21.72c2.64 0 4.86-.88 6.47-2.38l-3.16-2.26c-.88.59-2 .94-3.31.94-2.55 0-4.71-1.72-5.48-4.04H3.25v2.33A9.77 9.77 0 0 0 12 21.72Z"
      />
      <path
        fill="#FBBC05"
        d="M6.52 13.98A5.88 5.88 0 0 1 6.21 12c0-.69.12-1.36.31-1.98V7.69H3.25A9.77 9.77 0 0 0 2.23 12c0 1.57.38 3.06 1.02 4.31l3.27-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.44 0 2.72.49 3.74 1.46l2.8-2.8A9.39 9.39 0 0 0 12 2.28a9.77 9.77 0 0 0-8.75 5.41l3.27 2.33C7.29 7.7 9.45 5.98 12 5.98Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const oauthError = OAUTH_ERRORS[searchParams.get("error") ?? ""];
  const passwordReset = searchParams.get("reset") === "1";

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const result = await login(values);
      queryClient.setQueryData(["auth", "me"], result.user);
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      navigate("/", { replace: true });
    } catch (error) {
      setServerError(error instanceof ApiError ? error.detail : "Something went wrong");
    }
  };

  const signInWithGoogle = () => {
    window.location.assign(`${API_URL}/auth/google/authorize`);
  };

  return (
    <main className="auth-login-shell">
      <section className="auth-story-panel" aria-labelledby="auth-story-title">
        <div className="auth-story-copy">
          <h1 id="auth-story-title">Don’t lose the thread.</h1>
          <p className="auth-story-description">
            Applications, CVs, conversations and interviews — all connected in one place.
          </p>
        </div>
        <ThreadStoryline />
        <p className="auth-story-continuation">Your career story continues here</p>
      </section>

      <section className="auth-form-panel" aria-label="Sign in">
        <div className="auth-form-wrap">
          <div className="auth-form-brand-row">
            <BrandLogo className="auth-brand-logo" />
            <div className="auth-theme-toggle">
              <ModeToggle inverted />
            </div>
          </div>
          <Card className="auth-login-card">
            <CardHeader className="auth-card-header items-center text-center">
              <h2 className="text-2xl font-semibold leading-tight text-kumo-strong">
                Pick up where you left off.
              </h2>
              <CardDescription>Welcome back to your career workspace.</CardDescription>
            </CardHeader>
            <CardContent className="auth-card-content">
              <div className="flex flex-col gap-4">
                {oauthError && (
                  <Alert variant="destructive" role="alert">
                    {oauthError}
                  </Alert>
                )}
                {passwordReset && !oauthError && (
                  <Alert variant="success" role="status">
                    Password updated. Sign in with your new password.
                  </Alert>
                )}
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      aria-label="Email address"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "login-email-error" : undefined}
                      {...field("email")}
                    />
                    {errors.email && (
                      <p id="login-email-error" role="alert" className="text-xs text-destructive">
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="auth-password-field">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        aria-label="Password"
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? "login-password-error" : undefined}
                        className="auth-password-input"
                        {...field("password")}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((visible) => !visible)}
                      >
                        {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p id="login-password-error" role="alert" className="text-xs text-destructive">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                  <div className="auth-form-options">
                    <label className="auth-remember-option" htmlFor="remember-me">
                      <input id="remember-me" type="checkbox" />
                      <span>Remember me</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  {serverError && (
                    <p
                      id="login-server-error"
                      role="alert"
                      aria-live="assertive"
                      className="text-sm text-destructive"
                    >
                      {serverError}
                    </p>
                  )}
                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                </form>
                <div className="flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-kumo-hairline" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-kumo-hairline" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={signInWithGoogle}
                >
                  <GoogleIcon />
                  Continue with Google
                </Button>
              </div>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link to="/register" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
