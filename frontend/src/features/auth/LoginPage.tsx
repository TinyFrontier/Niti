import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { login } from "@/features/auth/api";
import { API_URL, ApiError } from "@/shared/api/client";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
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

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
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
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4"><ModeToggle /></div>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <BrandLogo className="mb-3 h-11" />
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {oauthError && <Alert variant="destructive">{oauthError}</Alert>}
            {passwordReset && !oauthError && (
              <Alert variant="success">Password updated. Sign in with your new password.</Alert>
            )}
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...field("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input id="password" type="password" {...field("password")} />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" disabled={isSubmitting}>
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
              className="w-full"
              onClick={signInWithGoogle}
            >
              Continue with Google
            </Button>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
