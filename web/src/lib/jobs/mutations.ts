/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { toast } from 'sonner';
import type { MutationOutcome } from '../../stores/jobs';

export const QUEUED_NOT_DELIVERED = 'Queued on the server; delivery is not confirmed.';
export const REFRESH_FAILED = 'Accepted by the server, but the agenda could not be reloaded. Displayed data may be outdated.';

export interface MutationFeedback {
  /** Toast id so repeated attempts replace one another. */
  id: string;
  pending?: string;
  success: string;
  description?: string;
  failure: string;
  action: () => Promise<MutationOutcome>;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Runs one store mutation and reports it. Success is announced only after the server
 * accepted the write; a failed follow-up refresh is a separate warning, never a failure.
 * Resolves true only when the server accepted the write.
 */
export async function runWithFeedback(feedback: MutationFeedback): Promise<boolean> {
  if (feedback.pending) toast.loading(feedback.pending, { id: feedback.id });
  try {
    const outcome = await feedback.action();
    toast.success(feedback.success, { id: feedback.id, description: feedback.description });
    if (!outcome.refreshed) toast.warning(REFRESH_FAILED, { id: `${feedback.id}-refresh` });
    return true;
  } catch (error: unknown) {
    toast.error(`${feedback.failure}: ${errorMessage(error, 'request failed')}`, { id: feedback.id });
    return false;
  }
}
