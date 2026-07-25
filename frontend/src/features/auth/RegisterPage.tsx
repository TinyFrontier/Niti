import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { login, register as registerUser } from "@/features/auth/api";
import { API_URL, ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { BrandLogo } from "@/shared/ui/brand-logo";
import { ModeToggle } from "@/shared/ui/mode-toggle";

const schema = z.object({
  full_name: z.string().max(255).optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await registerUser(values);
      const result = await login({ email: values.email, password: values.password });
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
          <CardTitle className="text-xl">Create account</CardTitle>
          <CardDescription>Start tracking your job search</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" placeholder="Jane Doe" {...field("full_name")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...field("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...field("password")} />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create account"}
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
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
