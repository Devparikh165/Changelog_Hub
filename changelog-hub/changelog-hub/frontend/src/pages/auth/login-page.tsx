import { type FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/auth/auth-context";
import { AuthCard } from "@/pages/auth/auth-layout";
import { PasswordInput } from "@/pages/auth/password-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toastManager } from "@/components/ui/toast";
import { ApiError, api } from "@/lib/api";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      const user = await login(String(data.get("email")), String(data.get("password")));
      toastManager.add({ title: `Welcome back, ${user.name.split(" ")[0]}`, type: "success" });
      navigate(from ?? (user.role === "admin" ? "/admin" : "/"), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "error", "Sign-in failed. Try again."));
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const res = await api<{ message: string }>("/api/v1/auth/resend-verification", {
        method: "POST",
        body: { email },
      });
      toastManager.add({ title: "Verification email sent", description: res.message, type: "success" });
    } catch (err) {
      toastManager.add({ title: "Couldn't resend", description: (err as Error).message, type: "error" });
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard
      description="Sign in to react to updates and keep track of what you've read."
      footer={
        <>
          New here?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/signup">
            Create an account
          </Link>
        </>
      }
      title="Sign in"
    >
      <Form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error?.code === "email_not_verified" ? (
          <Alert variant="warning">
            <AlertTitle>Confirm your email first</AlertTitle>
            <AlertDescription>
              <p>We sent a link to {email}. Open it, then sign in again.</p>
              <div className="mt-2 flex gap-2">
                <Button loading={resending} onClick={resend} size="xs" variant="outline">
                  Send a new link
                </Button>
                <Button render={<Link to="/dev/mailbox" />} size="xs" variant="ghost">
                  Open dev inbox
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : error ? (
          <Alert variant="error">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : null}

        <Field name="email">
          <FieldLabel>Email</FieldLabel>
          <Input
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            type="email"
            value={email}
          />
          <FieldError>Enter a valid email address.</FieldError>
        </Field>
        <Field name="password">
          <div className="flex w-full items-center justify-between">
            <FieldLabel>Password</FieldLabel>
            <Link className="text-muted-foreground text-xs hover:text-foreground" to="/forgot-password">
              Forgot password?
            </Link>
          </div>
          <PasswordInput autoComplete="current-password" name="password" required />
          <FieldError>Enter your password.</FieldError>
        </Field>
        <Button className="mt-1 w-full" loading={pending} type="submit">
          Sign in
        </Button>
      </Form>
    </AuthCard>
  );
}
