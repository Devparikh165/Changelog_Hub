import { MailCheckIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { AuthCard } from "@/pages/auth/auth-layout";
import { PASSWORD_HINT, PasswordInput } from "@/pages/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";

export function SignupPage() {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password"));
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setErrors({ password: PASSWORD_HINT });
      return;
    }
    setPending(true);
    setFormError(null);
    setErrors({});
    try {
      await api("/api/v1/auth/signup", {
        method: "POST",
        body: { name: data.get("name"), email: data.get("email"), password },
      });
      setSentTo(String(data.get("email")));
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) setErrors(err.fieldErrors);
      else if (err instanceof ApiError && err.code === "email_taken") setErrors({ email: err.message });
      else setFormError((err as Error).message);
    } finally {
      setPending(false);
    }
  };

  if (sentTo) {
    return (
      <AuthCard
        description={
          <>
            We sent a confirmation link to <strong className="text-foreground">{sentTo}</strong>. It expires in 24
            hours.
          </>
        }
        title="Check your inbox"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
            <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-muted-foreground">
              Email delivery is simulated in this environment. The message is waiting in the dev inbox.
            </p>
          </div>
          <Button render={<Link to={`/dev/mailbox?email=${encodeURIComponent(sentTo)}`} />}>Open dev inbox</Button>
          <Button render={<Link to="/login" />} variant="ghost">
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      description="Get notified about new releases and react to the ones you like."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-medium text-foreground underline-offset-4 hover:underline" to="/login">
            Sign in
          </Link>
        </>
      }
      title="Create an account"
    >
      <Form className="flex flex-col gap-4" errors={errors} onSubmit={onSubmit}>
        {formError && (
          <Alert variant="error">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <Field name="name">
          <FieldLabel>Name</FieldLabel>
          <Input autoComplete="name" maxLength={80} placeholder="Ada Lovelace" required />
          <FieldError />
        </Field>
        <Field name="email">
          <FieldLabel>Email</FieldLabel>
          <Input autoComplete="email" placeholder="you@company.com" required type="email" />
          <FieldError />
        </Field>
        <Field name="password">
          <FieldLabel>Password</FieldLabel>
          <PasswordInput autoComplete="new-password" minLength={8} name="password" required />
          <FieldDescription>{PASSWORD_HINT}</FieldDescription>
          <FieldError />
        </Field>
        <Button className="mt-1 w-full" loading={pending} type="submit">
          Create account
        </Button>
      </Form>
    </AuthCard>
  );
}
