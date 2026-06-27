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
