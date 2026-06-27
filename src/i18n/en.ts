export const en = {
  common: {
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    continue: 'Continue',
    finish: 'Finish',
    soon: 'Coming soon',
    proOnly: 'Pro only',
  },
  settings: {
    title: 'Settings',
    languageTitle: 'Language',
    deviceLanguage: 'Device language (automatic)',
    hebrew: 'Hebrew',
    english: 'English',
    financialGlossary: 'Financial glossary',
    importInstallments: 'Add existing installments',
    contactIssuer: 'Contact the card issuer',
    deleteProfile: 'Delete profile',
    deleteProfilePrompt: 'Delete the profile {{name}}?',
  },
  profile: {
    add: 'Add profile',
    saveName: 'Save name',
    rename: 'Rename',
  },
  cards: {
    title: 'My cards',
    subtitle: 'All cards saved on this device.',
    empty: 'No cards found',
    add: 'Add card',
    unknownClub: 'Unknown club 🔍',
    standardClub: 'Standard club',
    endingIn: 'Ending in {{last4}}',
  },
  purchaseGate: {
    title: 'Purchase check',
    subtitle: 'Check whether this purchase fits your current cash flow.',
    domestic: 'Israel 🇮🇱',
    international: 'Abroad ✈️',
    amount: 'Purchase amount',
    invalidAmount: 'Invalid amount',
    check: 'Check purchase',
    noCards: 'No cards found — add a card first',
    placeholder: 'Your decision will appear here after the check.',
    approved: 'Approved',
    warning: 'Warning',
    blocked: 'Blocked',
    wait: 'Wait 24 hours',
  },
  decision: {
    approved: 'Approved ✓',
    warning: 'Pay attention ⚠️',
    blocked: 'Blocked ✗',
    wait: 'Wait 24 hours ⏳',
    approvedReason: 'The purchase appears to fit your current cash flow.',
    warningReason:
      'You can make the purchase, but pay attention to your safety margin.',
    blockedReason:
      'The purchase may put your cash flow or credit limit at risk.',
    waitReason:
      'The purchase is not urgent. Consider waiting before deciding.',
    cardScores: 'Card scores',
    leadingCard: 'Leading card',
    alternativeCard: 'Alternative card',
    problem: 'Need help?',
  },
  calendar: {
    empty: 'No scheduled charges 📅',
  },
  contact: {
    title: 'Contact the card issuer',
    wrongCharge: 'Incorrect charge',
    cancelTransaction: 'Cancel transaction',
    chargeReturn: 'Returned charge',
    generalQuestion: 'General question',
    whatToSay: 'What to say',
    callNow: 'Call now',
    wrongChargeScript1:
      'Hello, I would like to report an incorrect charge on my account.',
    wrongChargeScript2: 'Can you help me review the transaction?',
    cancelScript1:
      'Hello, I would like to check whether a card transaction can be canceled.',
    cancelScript2: 'Can you explain what is required to open the request?',
    returnScript1:
      'Hello, I received an alert or am concerned about a returned card charge.',
    returnScript2:
      'Can you check the charge status and explain what I can do now?',
    generalScript1:
      'Hello, I have a question about activity or terms on my credit card.',
    generalScript2: 'Please help me understand the details before I continue.',
  },
  home: {
    saved: '₪0 saved',
    savingsSubtitle: 'Your savings so far',
    dailyTip: "Today's tip",
    upcoming: 'Upcoming charges',
    noUpcoming: 'No upcoming charges 📅',
    upcomingCount: '{{count}} upcoming charges',
    travelTitle: 'Traveling abroad? ✈️',
    travelBody:
      'Soon you will be able to check which card is best for travel and foreign-currency charges.',
    checkPurchase: 'Check purchase',
    tips: [
      'Pay on the billing date to maximize your interest-free period',
      'Avoid foreign charges without a low-fee card',
      'Use installments only when the interest cost makes sense',
      'Check returned-charge risk before every large purchase',
      'Use the right club card for each purchase category',
    ],
  },
  installments: {
    title: 'Existing installments',
    merchant: 'Merchant name',
    total: 'Total amount (₪)',
    monthsRemaining: 'Months remaining',
    monthlyPayment: 'Monthly payment (₪)',
    billingCard: 'Billing card',
    noCards: 'Add a card before importing installments.',
    notes: 'Notes (optional)',
    add: 'Add installments',
    save: 'Save changes',
    deleteTitle: 'Delete installments',
    deletePrompt: 'Delete the installments for {{name}}?',
    remaining: '{{count}} months remaining',
    validation:
      'Complete all required fields. Amounts must be up to ₪999,999 and months between 1 and 360.',
  },
  onboarding: {
    bankQuestion: 'Which bank holds your account?',
    moreBanks: 'More banks (8)',
    financialDetails: 'Financial details',
    monthlyIncome: 'Monthly income (₪)',
    currentBalance: 'Current balance (₪)',
    incomeExample: 'For example: 12000',
    balanceExample: 'For example: 3500',
    invalidIncome: 'Enter a valid monthly income',
    invalidBalance: 'Enter a valid balance',
    addFirstCard: 'Add your first card',
    issuer: 'Card issuer',
    club: 'Card club',
    unknownClub: "I don't know the club 🔍",
    phone: 'Phone number',
    phoneHelp: 'Phone number for future account recovery (optional)',
    finishPrompt: 'Confirm completion',
    useCode: 'Use code',
    authFailed: 'Authentication was not completed. Try again.',
    authError: 'We could not complete authentication. Try again.',
  },
  glossary: {
    title: 'Financial glossary',
    intro:
      'Plain-language explanations of common terms. This information is educational only and is not financial advice.',
    impact: 'How does this affect you?',
    terms: [
      {
        title: 'Credit limit',
        explanation:
          'The maximum amount the card issuer allows to be charged at one time. Unpaid transactions use part of the limit until the billing date passes and they are paid.',
        example:
          'Example: With a ₪10,000 limit, ₪3,000 in pending charges leaves ₪7,000 available.',
      },
      {
        title: 'Returned charge',
        explanation:
          'A charge presented to the bank account was not paid, usually because the balance was insufficient. It may be returned to the issuer and lead to fees or additional handling.',
        example:
          'Example: If ₪2,000 is due on the billing date and the account lacks sufficient funds, the bank may return the charge.',
      },
      {
        title: 'Compound interest',
        explanation:
          'Interest calculated on both the original amount and previously accumulated interest. Over longer periods, it can grow faster than simple interest.',
        example:
          'Example: When interest is added to the balance each period, the next calculation uses the new, higher balance.',
      },
      {
        title: 'Currency conversion fee',
        explanation:
          'A fee charged when a transaction uses a currency different from the account currency. The rate and conversion terms vary by card and issuer.',
        example:
          'Example: A dollar purchase billed in shekels may include currency conversion and a percentage fee.',
      },
      {
        title: 'Installments',
        explanation:
          'A purchase amount divided into several monthly charges. Each payment affects future monthly expenses, and some installment plans also include interest.',
        example:
          'Example: A ₪1,200 purchase in 12 installments is usually about ₪100 per month, before any interest or fees.',
      },
      {
        title: 'Deferred charge',
        explanation:
          'A transaction whose payment is postponed instead of collected immediately. Depending on the transaction, deferral may be free or include interest and fees.',
        example:
          'Example: A purchase made today but billed next month is deferred until the agreed date.',
      },
      {
        title: 'Billing date',
        explanation:
          'The day each month when the issuer groups transactions and charges the bank account. Transactions near that date may appear in the current or next bill.',
        example:
          'Example: For a card billed on the 10th, the total is generally deducted from the bank account on that date.',
      },
      {
        title: 'Plan',
        explanation:
          'A set of terms defining how a financial product operates over time. It may determine interest, duration, indexation, fees, or usage rules.',
        example:
          'Example: Two plans for the same product may differ in interest rate, duration, and how the payment changes.',
      },
      {
        title: 'Club',
        explanation:
          'A card affiliation with a customer group, organization, or benefits program. The club may offer discounts and benefits under defined terms.',
        example:
          'Example: A club card may provide discounts with club partners, subject to the benefit terms.',
      },
    ],
  },
} as const;

export const enBySource: Readonly<Record<string, string>> = {
  הגדרות: en.settings.title,
  שפה: en.settings.languageTitle,
  'שפת המכשיר אוטומטי': en.settings.deviceLanguage,
  עברית: en.settings.hebrew,
  'מילון פיננסי': en.settings.financialGlossary,
  'הוסף תשלומים קיימים': en.settings.importInstallments,
  'צור קשר עם חברת האשראי': en.contact.title,
  'מחיקת פרופיל': en.settings.deleteProfile,
  'למחוק את הפרופיל {{name}}?': en.settings.deleteProfilePrompt,
  ביטול: en.common.cancel,
  מחיקה: en.common.delete,
  עריכה: en.common.edit,
  חזרה: en.common.back,
  המשך: en.common.continue,
  סיום: en.common.finish,
  בקרוב: en.common.soon,
  'Pro בלבד': en.common.proOnly,
  'הוסף פרופיל': en.profile.add,
  'שמור שם': en.profile.saveName,
  'שינוי שם': en.profile.rename,
  'הכרטיסים שלי': en.cards.title,
  'כל הכרטיסים שנשמרו במכשיר.': en.cards.subtitle,
  'לא נמצאו כרטיסים': en.cards.empty,
  'הוסף כרטיס': en.cards.add,
  'מועדון לא ידוע 🔍': en.cards.unknownClub,
  'מועדון רגיל': en.cards.standardClub,
  'מסתיים ב-{{last4}}': en.cards.endingIn,
  'בדיקת רכישה': en.purchaseGate.title,
  'בדקו אם הרכישה מתאימה לתזרים הנוכחי.': en.purchaseGate.subtitle,
  'בארץ 🇮🇱': en.purchaseGate.domestic,
  'חו"ל ✈️': en.purchaseGate.international,
  'סכום הרכישה': en.purchaseGate.amount,
  'סכום לא תקין': en.purchaseGate.invalidAmount,
  'בדוק רכישה': en.purchaseGate.check,
  'לא נמצאו כרטיסים — הוסף כרטיס תחילה': en.purchaseGate.noCards,
  'ההחלטה תופיע כאן אחרי הבדיקה.': en.purchaseGate.placeholder,
  'סכום הרכישה אינו תקין. הזן סכום בין ₪0.01 ל-₪999,999.':
    'The purchase amount is invalid. Enter an amount between ₪0.01 and ₪999,999.',
  'נתוני התזרים אינם תקינים. לא ניתן לאשר את הרכישה.':
    'The cash-flow data is invalid, so the purchase cannot be approved.',
  'הכנסה חודשית חסרה או לא תקינה. לא ניתן לאשר רכישה.':
    'Monthly income is missing or invalid, so the purchase cannot be approved.',
  'ניצול מסגרת האשראי יעבור 90%, ולכן הרכישה חסומה.':
    'Credit-limit utilization would exceed 90%, so the purchase is blocked.',
  'מרווח הביטחון אחרי הרכישה נמוך מ-5% מההכנסה.':
    'The safety margin after the purchase is below 5% of income.',
  'הרכישה אינה חיונית ומרווח הביטחון צפוף. כדאי להמתין 24 שעות.':
    'The purchase is not essential and the safety margin is tight. Consider waiting 24 hours.',
  'ניצול מסגרת האשראי יעבור 70%, מומלץ לשקול כרטיס אחר.':
    'Credit-limit utilization would exceed 70%. Consider another card.',
  'מרווח הביטחון אחרי הרכישה הוא 5%-20% מההכנסה.':
    'The safety margin after the purchase is 5%–20% of income.',
  'מרווח הביטחון אחרי הרכישה גבוה מ-20% מההכנסה.':
    'The safety margin after the purchase is above 20% of income.',
  מאושר: en.purchaseGate.approved,
  אזהרה: en.purchaseGate.warning,
  חסום: en.purchaseGate.blocked,
  'להמתין 24 שעות': en.purchaseGate.wait,
  'אושר ✓': en.decision.approved,
  'שים לב ⚠️': en.decision.warning,
  'נחסם ✗': en.decision.blocked,
  'המתן 24 שעות ⏳': en.decision.wait,
  'הרכישה נראית מתאימה לתזרים הנוכחי.': en.decision.approvedReason,
  'אפשר לבצע את הרכישה, אבל כדאי לשים לב למרווח הביטחון.':
    en.decision.warningReason,
  'הרכישה עלולה לסכן את התזרים או את מסגרת האשראי.':
    en.decision.blockedReason,
  'הרכישה אינה דחופה ומומלץ להמתין לפני קבלת החלטה.':
    en.decision.waitReason,
  'ניקוד כרטיסים': en.decision.cardScores,
  'כרטיס מוביל': en.decision.leadingCard,
  'כרטיס חלופי': en.decision.alternativeCard,
  'יש לך בעיה?': en.decision.problem,
  'אין חיובים מתוכננים 📅': en.calendar.empty,
  'חיוב שגוי': en.contact.wrongCharge,
  'ביטול עסקה': en.contact.cancelTransaction,
  'חזרת חיוב': en.contact.chargeReturn,
  'שאלה כללית': en.contact.generalQuestion,
  'מה לומר': en.contact.whatToSay,
  'התקשר עכשיו': en.contact.callNow,
  'שלום, אני רוצה לדווח על חיוב שגוי בחשבוני.':
    en.contact.wrongChargeScript1,
  'יכול/ה לעזור לי לבדוק את הפעולה?': en.contact.wrongChargeScript2,
  'שלום, אני רוצה לבדוק אפשרות לביטול עסקה שבוצעה בכרטיס.':
    en.contact.cancelScript1,
  'אפשר להסביר לי מה נדרש כדי לפתוח את הבקשה?':
    en.contact.cancelScript2,
  'שלום, קיבלתי התרעה או חשש לחזרת חיוב בכרטיס.':
    en.contact.returnScript1,
  'אפשר לבדוק את מצב החיוב ומה אפשר לעשות עכשיו?':
    en.contact.returnScript2,
  'שלום, יש לי שאלה לגבי פעילות או תנאים בכרטיס האשראי.':
    en.contact.generalScript1,
  'אשמח שתעזרו לי להבין את הפרטים לפני שאמשיך.':
    en.contact.generalScript2,
  '₪0 נחסך': en.home.saved,
  'החיסכון שלך עד עכשיו': en.home.savingsSubtitle,
  'טיפ היום': en.home.dailyTip,
  'חיובים קרובים': en.home.upcoming,
  'אין חיובים קרובים 📅': en.home.noUpcoming,
  'יש {{count}} חיובים קרובים': en.home.upcomingCount,
  'נוסעים לחו"ל? ✈️': en.home.travelTitle,
  'בקרוב תוכלו לבדוק מראש איזה כרטיס עדיף לנסיעות ולחיובים במט"ח.':
    en.home.travelBody,
  'שלם ביום חיוב כדי למקסם את תקופת האשראי': en.home.tips[0],
  'הימנע מחיובים בחו"ל ללא כרטיס ללא עמלה': en.home.tips[1],
  'פרוס לתשלומים רק כשהריבית שווה': en.home.tips[2],
  'בדוק חזרת חיוב לפני כל רכישה גדולה': en.home.tips[3],
  'השתמש במועדון הנכון לכל סוג קנייה': en.home.tips[4],
  'תשלומים קיימים': en.installments.title,
  'שם בית העסק': en.installments.merchant,
  'סכום כולל (₪)': en.installments.total,
  'חודשים שנותרו': en.installments.monthsRemaining,
  'תשלום חודשי (₪)': en.installments.monthlyPayment,
  'כרטיס לחיוב': en.installments.billingCard,
  'יש להוסיף כרטיס לפני ייבוא תשלומים.': en.installments.noCards,
  'הערות (אופציונלי)': en.installments.notes,
  'הוסף תשלומים': en.installments.add,
  'שמור שינויים': en.installments.save,
  'מחיקת תשלומים': en.installments.deleteTitle,
  'למחוק את התשלומים של {{name}}?': en.installments.deletePrompt,
  '{{count}} חודשים נותרו': en.installments.remaining,
  'יש למלא את כל שדות החובה. סכומים עד 999,999 ₪ ומספר חודשים בין 1 ל־360.':
    en.installments.validation,
  'באיזה בנק אתה מנהל את החשבון?': en.onboarding.bankQuestion,
  'בנקים נוספים (8)': en.onboarding.moreBanks,
  'פרטים פיננסיים': en.onboarding.financialDetails,
  'הכנסה חודשית (₪)': en.onboarding.monthlyIncome,
  'יתרה נוכחית (₪)': en.onboarding.currentBalance,
  'לדוגמה: 12000': en.onboarding.incomeExample,
  'לדוגמה: 3500': en.onboarding.balanceExample,
  'נא להזין הכנסה חודשית תקינה': en.onboarding.invalidIncome,
  'נא להזין יתרה תקינה': en.onboarding.invalidBalance,
  'הוסף את הכרטיס הראשון שלך': en.onboarding.addFirstCard,
  'חברת כרטיס האשראי': en.onboarding.issuer,
  'מועדון הכרטיס': en.onboarding.club,
  'אני לא יודע את המועדון 🔍': en.onboarding.unknownClub,
  'מספר טלפון': en.onboarding.phone,
  'מספר טלפון - לשחזור חשבון בעתיד (אופציונלי)':
    en.onboarding.phoneHelp,
  'אישור סיום': en.onboarding.finishPrompt,
  'השתמש בקוד': en.onboarding.useCode,
  'האימות לא הושלם. נסה שוב.': en.onboarding.authFailed,
  'לא הצלחנו להשלים את האימות. נסה שוב.': en.onboarding.authError,
  לאומי: 'Leumi',
  הפועלים: 'Hapoalim',
  דיסקונט: 'Discount',
  מזרחי: 'Mizrahi',
  'הבינלאומי הראשון': 'First International Bank',
  ירושלים: 'Bank of Jerusalem',
  מסד: 'Massad',
  'מרכנתיל דיסקונט': 'Mercantile Discount',
  יהב: 'Yahav',
  אגוד: 'Union Bank',
  אחר: 'Other',
  'מועדון מקס רגיל': 'Standard Max club',
  'ישראכרט רגיל': 'Standard Isracard',
  'ישראכרט זהב': 'Isracard Gold',
  'אמריקן אקספרס': 'American Express',
  'ויזה כאל': 'Visa CAL',
  'ויזה פלטינום': 'Visa Platinum',
  'הסברים כלליים למונחים נפוצים. המידע נועד להבנה בלבד ואינו ייעוץ פיננסי.':
    en.glossary.intro,
  'כיצד זה משפיע עליך?': en.glossary.impact,
  בית: 'Home',
  'בדיקת קנייה': 'Purchase Gate',
  כרטיסים: 'Cards',
  לוח: 'Calendar',
  תפריט: 'Settings',
  'אימות להמשך': 'Authenticate to continue',
  'פתיחת נעילה לצורכי פיתוח': 'DEBUG: Unlock',
};
