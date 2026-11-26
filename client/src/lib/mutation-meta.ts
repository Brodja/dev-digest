/* mutation-meta.ts — opt a mutation out of the global error toast.
   Every mutation error is toasted globally (providers.tsx). A mutation whose
   caller shows its own, more specific toast sets this meta so the user does not
   get the same failure twice. */

export const LOCAL_ERROR_TOAST = { localErrorToast: true } as const;

/** True when the mutation's caller shows its own error toast. */
export function hasLocalErrorToast(meta: unknown): boolean {
  return (meta as { localErrorToast?: unknown } | undefined)?.localErrorToast === true;
}
