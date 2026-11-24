"use client";

import { startTransition, useActionState } from "react";

/**
 * Like useActionState, but submits through onSubmit so React does NOT reset the form
 * afterwards. Without this, a validation error would wipe everything the user typed.
 */
export function useFormAction<S>(action: (prev: S | null, form: FormData) => Promise<S>) {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return [state, onSubmit, pending] as const;
}
