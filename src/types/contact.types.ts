export type ProblemType =
  | 'wrong_charge'
  | 'cancel_transaction'
  | 'charge_return'
  | 'general_question';

export interface IssuerContact {
  readonly name: string;
  readonly phone: string;
}
