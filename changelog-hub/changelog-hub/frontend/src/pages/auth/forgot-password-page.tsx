import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { AuthCard } from "@/pages/auth/auth-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string; message: string } | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setPending(true);
    setError(null);
    try {
      const res = await api<{ message: string }>("/api/v1/auth/forgot-password", { method: "POST", body: { email } });
      setSent({ email, message: res.message });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <AuthCard description={sent.message} title="Check your inbox">
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">The link works once and expires in 30 minutes.</p>
          <Button render={<Link to={`/dev/mailbox?email=${encodeURIComponent(sent.email)}`} />}>Open dev inbox</Button>
          <Button render={<Link to="/login" />} variant="ghost">
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      description="Enter the email you signed up with and we'll send you a reset link."
      footer={
        <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/login">
          Back to sign in
        </Link>
      }
      title="Reset your password"
    >
      <Form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field name="email">
          <FieldLabel>Email</FieldLabel>
          <Input autoComplete="email" placeholder="you@company.com" required type="email" />
          <FieldError>Enter a valid email address.</FieldError>
        </Field>
        <Button className="w-full" loading={pending} type="submit">
          Send reset link
        </Button>
      </Form>
    </AuthCard>
  );
}
