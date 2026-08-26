export const he = {
  common: {
    cancel: 'ביטול',
    delete: 'מחיקה',
    edit: 'עריכה',
    back: 'חזרה',
    continue: 'המשך',
    finish: 'סיום',
  },
  settings: {
    title: 'הגדרות',
    languageTitle: 'שפה',
    financialGlossary: 'מילון פיננסי',
    importInstallments: 'הוסף תשלומים קיימים',
    contactIssuer: 'צור קשר עם חברת האשראי',
  },
  profile: {
    add: 'הוסף פרופיל',
    saveName: 'שמור שם',
    rename: 'שינוי שם',
  },
  cards: {
    title: 'הכרטיסים שלי',
    empty: 'לא נמצאו כרטיסים',
    add: 'הוסף כרטיס',
  },
  purchaseGate: {
    title: 'בדיקת רכישה',
    amount: 'סכום הרכישה',
    check: 'בדוק רכישה',
  },
  /** P4 criterion C1 — the Check Input surface. Title, amount and action are shared with the
   *  legacy purchase-gate strings above; only what C1 adds is new. */
  checkInput: {
    currency: 'מטבע',
    amountRequired: 'צריך סכום גדול מאפס כדי להמשיך',
    restOptional: 'קטגוריה, תשלומים ובחירת כרטיס אינם חובה',
  },
  checkVerdict: {
    goodToGo: 'אפשר לקנות',
    caution: 'זהירות',
    dontBuyNow: 'לא לקנות עכשיו',
    waitUntilBilling: 'חכי עד שהחיוב יעבור',
    financialImpact: 'השפעה כלכלית',
    purchaseMonthly: 'התחייבות חודשית מהרכישה',
    loadAfterPurchase: 'עומס אחרי הרכישה',
    hardHeadroom: 'מרווח עד הסף הקשיח',
    loadAfterBilling: 'עומס אחרי החיוב',
    noCategory: 'ללא קטגוריה',
    onePayment: 'תשלום אחד',
    installments: 'תשלומים',
    bestForPurchase: 'הטובה לרכישה הזו',
    matchScore: 'ציון התאמה',
    howScoresWork: 'איך הציונים עובדים',
    howScoresWorkBody:
      'הציון יחסי בין הכרטיסים שלך: 100 לעלות הנמוכה ביותר, 0 לגבוהה ביותר. זה לא ציון מוחלט.',
    alsoGood: 'גם טוב',
    saves: 'חוסכת',
    less: 'פחות',
  },
  calendar: {
    empty: 'אין חיובים מתוכננים 📅',
  },
  contact: {
    title: 'צור קשר עם חברת האשראי',
  },
  glossary: {
    title: 'מילון פיננסי',
    impact: 'כיצד זה משפיע עליך?',
  },
} as const;

export function translateHebrew(source: string): string {
  return source;
}
