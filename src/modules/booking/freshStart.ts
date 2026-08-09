/**
 * Whether the appointment form should wipe the draft on entry (#16). A booking
 * is "being continued" only when the provider tapped Промени (`resume`) or is
 * editing an existing appointment (`appt`); everything else that reaches the
 * form is a fresh booking and must not inherit an abandoned booking's fields.
 * The signal travels as a search param so it cannot linger past an abandon.
 */
export function shouldResetDraft(params: {
  appt?: string;
  resume?: boolean;
}): boolean {
  return !params.appt && !params.resume;
}
