export type ProblemType =
  | 'wrong_charge'
  | 'cancel_transaction'
  | 'charge_return'
  | 'general_question';

export interface IssuerContact {
  readonly name: string;
  /** As the issuer published it. Empty string when the corpus publishes no number. */
  readonly phone: string;
  /**
   * The dial URI, built by the contact authority rather than by a screen.
   *
   * Absent exactly when there is no number to dial, which is how the surface knows to render no
   * call button. A screen assembling `tel:` itself could not express an Israeli `*NNNN` line.
   */
  readonly telUri?: string;
  /** The page the number was captured from, so the surface can show where it came from. */
  readonly sourceUrl?: string;
}
