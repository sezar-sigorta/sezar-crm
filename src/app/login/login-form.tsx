"use client";

import { useFormAction } from "@/components/use-form-action";
import { login } from "./actions";

export function LoginForm() {
  const [state, onSubmit, pending] = useFormAction(login);
  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-6 shadow-xl shadow-black/20">
      <div>
        <label className="label" htmlFor="email">
          E-posta
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Şifre
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-accent">
          {state.error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Giriş yapılıyor…" : "Giriş yap"}
      </button>
    </form>
  );
}
