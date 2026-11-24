import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3 text-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-10 rounded-xl ring-1 ring-cream/20" />
          <div>
            <div className="font-display text-xl font-semibold leading-tight">Sezar CRM</div>
            <div className="text-xs text-navy-l">Sezar Sigorta ekibi için</div>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
