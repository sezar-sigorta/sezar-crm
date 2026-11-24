"use client";

import { startTransition, useActionState } from "react";

/**
 * Like useActionState, but submits through onSubmit so React does NOT reset the form
 * afterwards. Without this, a validation error would wipe everything the user typed.
 *
 * Spread `formProps` on the <form>: it also sets the server action as the form's `action`,
 * so a submit before the page has hydrated is a POST to the server action. Without it the
 * browser falls back to GET and puts every field (passwords too) in the URL.
 */
export function useFormAction<S>(action: (prev: S | null, form: FormData) => Promise<S>) {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  const formProps = { action: dispatch, onSubmit };
  return [state, formProps, pending] as const;
}
