import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { confirmPasswordReset } from "@/features/auth/api";
import { ApiError } from "@/shared/api/client";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { BrandLogo } from "@/shared/ui/brand-logo";
import { ModeToggle } from "@/shared/ui/mode-toggle";

const schema = z
  .object({
    new_password: z.string().min(8, "At least 8 characters"),
    confirm_password: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await confirmPasswordReset(token, values.new_password);
      navigate("/login?reset=1", { replace: true });
    } catch (error) {
      setServerError(
        error instanceof ApiError ? error.detail : "Something went wrong",
      );
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute right-4 top-4"><ModeToggle /></div>
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <BrandLogo className="mb-3 h-11" />
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>Enter and confirm your new password</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="flex flex-col gap-4">
              <Alert variant="destructive">
                This reset link is missing its token. Request a new one.
              </Alert>
              <Button onClick={() => navigate("/forgot-password")}>
                Request a new link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new_password">New password</Label>
                <Input id="new_password" type="password" {...field("new_password")} />
                {errors.new_password && (
                  <p className="text-xs text-destructive">{errors.new_password.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirm_password">Confirm password</Label>
                <Input id="confirm_password" type="password" {...field("confirm_password")} />
                {errors.confirm_password && (
                  <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
                )}
              </div>
              {serverError && <Alert variant="destructive">{serverError}</Alert>}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Set new password"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
