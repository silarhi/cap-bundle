/**
 * Sends the token of a Symfony UX Live Component form with the action its submit triggers, and only then: every
 * re-render submits the form (ComponentWithFormTrait), so a token in the model any earlier would be redeemed by the
 * first field the visitor changes. CapType renders the challenge with data-live-ignore, which keeps it, and its
 * token, out of the re-renders. Install the core first: it solves the challenges before this adapter sees the submit.
 * Idempotent.
 */
export declare function installLive(): void;