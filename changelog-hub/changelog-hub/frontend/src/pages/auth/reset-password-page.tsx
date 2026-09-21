import { type FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { AuthCard } from "@/pages/auth/auth-layout";
import { PASSWORD_HINT, PasswordInput } from "@/pages/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { toastManager } from "@/components/ui/toast";
import { ApiError, api } from "@/lib/api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirm"))) {
      setErrors({ confirm: "Passwords don't match." });
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setErrors({ password: PASSWORD_HINT });
      return;
    }
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await api<{ message: string }>("/api/v1/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      // The server revoked every session, including this browser's.
      if (user) await logout();
      toastManager.add({ title: "Password updated", description: res.message, type: "success" });
      navigate("/login", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.password) setErrors({ password: err.fieldErrors.password });
      else setFormError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  if (!token) {
    return (
      <AuthCard description="This reset link is missing its token." title="Link didn't work">
        <Button className="w-full" render={<Link to="/forgot-password" />}>
          Request a new link
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard description="Signing in with the new password ends all other sessions." title="Choose a new password">
      <Form className="flex flex-col gap-4" errors={errors} onSubmit={onSubmit}>
        {formError && (
          <Alert variant="error">
            <AlertDescription>
              {formError}{" "}
              <Link className="font-medium underline underline-offset-4" to="/forgot-password">
                Request a new link
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <Field name="password">
          <FieldLabel>New password</FieldLabel>
          <PasswordInput autoComplete="new-password" minLength={8} name="password" required />
          <FieldDescription>{PASSWORD_HINT}</FieldDescription>
          <FieldError />
        </Field>
        <Field name="confirm">
          <FieldLabel>Confirm password</FieldLabel>
          <PasswordInput autoComplete="new-password" name="confirm" required />
          <FieldError />
        </Field>
        <Button className="w-full" loading={pending} type="submit">
          Update password
        </Button>
      </Form>
    </AuthCard>
  );
}
