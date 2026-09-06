/**
 * WHAT TO SAY WHEN YOU RING THE ISSUER — four scripts, in three languages, and no claims.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE SCRIPTS SPEAK FOR THE USER, SO THEY MAY NOT ASSERT ANYTHING THE USER HAS NOT
 *
 * The campaign directive is explicit: *"do not make false claims on behalf of the user."* So every
 * line below is either a REQUEST ("I would like to ask about…") or a QUESTION ("what would it
 * take…"). None of them says the user spends a certain amount, has been offered a better rate
 * elsewhere, or intends to close the account — the three things a negotiation script is most
 * tempted to put in somebody's mouth, and the three the app cannot know.
 *
 * NO PRIVATE FIGURE IS INTERPOLATED. A script may name the CARD, because the user is holding it
 * and about to say its name out loud anyway. It never carries a balance, a limit, an income, a
 * fee the app resolved, or anything else from the vault: the message is opened in WhatsApp where
 * it becomes a message to a company, and financial data must not travel there because a template
 * put it in the box.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE TEXT IS EDITABLE BEFORE IT IS SENT
 *
 * The Hub copies or opens; it never sends. The directive's wording — *"let the user review/edit
 * the message"* — is why the sheet shows the whole text before offering either action.
 *
 * Every string is declared here in all three languages rather than through `t()`, because these
 * are not UI labels: they are the user's own words, and a fallback to Hebrew inside a message
 * somebody is about to send to their bank is a worse failure than a fallback in a heading.
 */

/** The four things people ring a card issuer to ask about a fee. */
export type NegotiationTopic =
  | 'waiver-renewal'
  | 'fee-reduction'
  | 'fee-clarification'
  | 'competing-offer';

export type ScriptLanguage = 'he' | 'ar' | 'en';

export const NEGOTIATION_TOPICS: readonly NegotiationTopic[] = [
  'waiver-renewal',
  'fee-reduction',
  'fee-clarification',
  'competing-offer',
];

interface ScriptSet {
  readonly he: string;
  readonly ar: string;
  readonly en: string;
}

/** `{{card}}` is the only placeholder, and it is the card's own display name. */
const SCRIPTS: Readonly<Record<NegotiationTopic, ScriptSet>> = {
  'waiver-renewal': {
    he: 'שלום, אני מחזיק/ה בכרטיס {{card}}. הפטור מדמי הכרטיס שלי עומד להסתיים, ואשמח לבדוק אם אפשר לחדש אותו. מה נדרש כדי להאריך אותו?',
    ar: 'مرحبًا، أحمل بطاقة {{card}}. الإعفاء من رسوم البطاقة على وشك الانتهاء، وأود الاستفسار عن إمكانية تجديده. ما المطلوب لتمديده؟',
    en: 'Hello, I hold the {{card}} card. My card-fee waiver is about to end and I would like to ask whether it can be renewed. What would be needed to extend it?',
  },
  'fee-reduction': {
    he: 'שלום, אני מחזיק/ה בכרטיס {{card}}. אני רוצה לבדוק אם יש אפשרות להפחית את דמי הכרטיס. אילו מסלולים או תנאים קיימים?',
    ar: 'مرحبًا، أحمل بطاقة {{card}}. أود الاستفسار عن إمكانية تخفيض رسوم البطاقة. ما المسارات أو الشروط المتاحة؟',
    en: 'Hello, I hold the {{card}} card. I would like to ask whether the card fee can be reduced. What tracks or conditions are available?',
  },
  'fee-clarification': {
    he: 'שלום, אני מחזיק/ה בכרטיס {{card}}. אשמח להבין בדיוק אילו דמי כרטיס חלים עליי — הסכום, התדירות, וכל הנחה או פטור שרלוונטיים לכרטיס שלי.',
    ar: 'مرحبًا، أحمل بطاقة {{card}}. أود أن أفهم بالضبط رسوم البطاقة المطبَّقة عليّ — المبلغ والوتيرة وأي خصم أو إعفاء ينطبق على بطاقتي.',
    en: 'Hello, I hold the {{card}} card. I would like to understand exactly which card fee applies to me — the amount, how often it is charged, and any discount or exemption that applies to my card.',
  },
  'competing-offer': {
    he: 'שלום, אני מחזיק/ה בכרטיס {{card}} ואני בוחן/ת את התנאים שלי. אשמח לדעת אילו תנאים אתם יכולים להציע לי בדמי הכרטיס לפני שאחליט.',
    ar: 'مرحبًا، أحمل بطاقة {{card}} وأراجع شروطي الحالية. أود معرفة الشروط التي يمكنكم تقديمها لي بخصوص رسوم البطاقة قبل أن أقرر.',
    en: 'Hello, I hold the {{card}} card and I am reviewing my terms. I would like to know what terms you can offer me on the card fee before I decide.',
  },
};

/**
 * The message, with the card name filled in.
 *
 * `cardName` is the nickname the user gave the card — their own text, going back to them. It is
 * trimmed and length-bounded because it leaves the app in a URL, and an unbounded string in a
 * `wa.me` link is a way to build a very long URL out of a text field.
 */
export function negotiationScript(
  topic: NegotiationTopic,
  language: ScriptLanguage,
  cardName: string,
): string {
  const safeName = cardName.trim().slice(0, 60);
  return SCRIPTS[topic][language].replaceAll('{{card}}', safeName);
}

/** The heading for a topic, in the reader's language. Kept beside the script it names. */
const TOPIC_LABELS: Readonly<Record<NegotiationTopic, ScriptSet>> = {
  'waiver-renewal': {
    he: 'חידוש הפטור מדמי כרטיס',
    ar: 'تجديد الإعفاء من رسوم البطاقة',
    en: 'Renew the card-fee waiver',
  },
  'fee-reduction': {
    he: 'הפחתת דמי הכרטיס',
    ar: 'تخفيض رسوم البطاقة',
    en: 'Reduce the card fee',
  },
  'fee-clarification': {
    he: 'הבהרת דמי הכרטיס',
    ar: 'توضيح رسوم البطاقة',
    en: 'Clarify the card fee',
  },
  'competing-offer': {
    he: 'השוואת תנאים',
    ar: 'مقارنة الشروط',
    en: 'Compare terms',
  },
};

export function negotiationTopicLabel(
  topic: NegotiationTopic,
  language: ScriptLanguage,
): string {
  return TOPIC_LABELS[topic][language];
}
