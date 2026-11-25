"use client";

import { useFormAction } from "@/components/use-form-action";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";

export function LoginForm() {
  const [state, formProps, pending] = useFormAction(login);
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Tekrar hoş geldin</CardTitle>
        <CardDescription>Sezar Sigorta ekip hesabınla giriş yap</CardDescription>
      </CardHeader>
      <CardContent>
        <form {...formProps} className="grid gap-6">
          <div className="grid gap-3">
            <Label htmlFor="email">
              E-posta
            </Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="grid gap-3">
            <Label htmlFor="password">
              Şifre
            </Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
