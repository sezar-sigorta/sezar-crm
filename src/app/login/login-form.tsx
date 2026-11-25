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
    <Card className="shadow-xl shadow-black/20">
      <CardHeader>
        <CardTitle className="font-display text-lg font-semibold">Giriş yap</CardTitle>
        <CardDescription>Ekip hesabınızla devam edin.</CardDescription>
      </CardHeader>
      <CardContent>
        <form {...formProps} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">
              E-posta
            </Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password" className="text-xs text-muted-foreground">
              Şifre
            </Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {state?.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Giriş yapılıyor…" : "Giriş yap"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
