declare global {
  interface DocumentEventMap {
    'turbo:submit-end': CustomEvent;
    'turbo:before-cache': CustomEvent;
  }
}
/**
 * Forgets the tokens Turbo Drive would reuse: tokens are single-use, so a form Turbo keeps on the page after
 * submitting it (stream response, morphed 422...) needs a new one, and a page restored from the Turbo cache must not
 * submit the tokens of its snapshot. Idempotent.
 */
export declare function installTurbo(): void;