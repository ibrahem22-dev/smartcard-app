import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '../components/AppText';
import { RtlScreen, RtlScrollView } from '../components/rtl';
import { useTranslation } from '../hooks/useTranslation';
import { en } from '../i18n/en';
import { ACCENT, BORDER, SURFACE, TEXT } from '../theme/tokens';

const GLOSSARY_TERMS = [
  {
    title: 'מסגרת אשראי',
    explanation:
      'הסכום המרבי שחברת האשראי מאפשרת לחייב בכרטיס בכל רגע. עסקאות שטרם נפרעו תופסות חלק מהמסגרת עד שמועד החיוב עובר והן משולמות.',
    example:
      'לדוגמה: במסגרת של 10,000 ₪, חיובים פתוחים בסך 3,000 ₪ משאירים 7,000 ₪ זמינים במסגרת.',
  },
  {
    title: 'חזרת חיוב',
    explanation:
      'מצב שבו חיוב שהוצג לחשבון הבנק לא שולם, לרוב מפני שלא הייתה יתרה מספקת. החיוב עשוי לחזור לחברת האשראי ולגרור עמלות או טיפול נוסף.',
    example:
      'לדוגמה: אם ביום החיוב נדרש תשלום של 2,000 ₪ ובחשבון אין סכום מספיק, הבנק עשוי להחזיר את החיוב.',
  },
  {
    title: 'ריבית דריבית',
    explanation:
      'ריבית שמחושבת גם על הסכום המקורי וגם על ריבית שכבר הצטברה. ככל שהתקופה ארוכה יותר, ההפרש לעומת ריבית פשוטה יכול לגדול.',
    example:
      'לדוגמה: כאשר ריבית מתווספת ליתרה בכל תקופה, חישוב הריבית הבא מתבצע על היתרה החדשה והגבוהה יותר.',
  },
  {
    title: 'עמלת המרה',
    explanation:
      'עמלה שנגבית כאשר מבצעים עסקה במטבע שונה מהמטבע שבו מחויב החשבון. שיעור העמלה ותנאי ההמרה משתנים בין כרטיסים וחברות.',
    example:
      'לדוגמה: רכישה בדולרים בכרטיס שמחויב בשקלים עשויה לכלול המרת מטבע ועמלה באחוז מסכום העסקה.',
  },
  {
    title: 'תשלומים',
    explanation:
      'חלוקה של סכום רכישה למספר חיובים חודשיים. כל תשלום תופס חלק מההוצאות בחודשים הבאים, ולעיתים העסקה כוללת גם ריבית.',
    example:
      'לדוגמה: רכישה של 1,200 ₪ ב־12 תשלומים תחויב בדרך כלל בכ־100 ₪ בכל חודש, לפני ריבית או עמלות אם קיימות.',
  },
  {
    title: 'חיוב נדחה',
    explanation:
      'עסקה שבה התשלום נדחה למועד מאוחר יותר במקום להיגבות מיד. בהתאם לסוג העסקה, הדחייה עשויה להיות ללא עלות או לכלול ריבית ועמלות.',
    example:
      'לדוגמה: רכישה שמתבצעת היום אך מחויבת רק בעוד חודש היא חיוב נדחה עד למועד שנקבע.',
  },
  {
    title: 'מועד חיוב',
    explanation:
      'היום בחודש שבו חברת האשראי מרכזת את העסקאות ומחייבת את חשבון הבנק. עסקאות שבוצעו סמוך למועד עשויות להיכלל בחיוב הנוכחי או בחיוב הבא.',
    example:
      'לדוגמה: בכרטיס שמועד החיוב שלו הוא ה־10 בחודש, סכום החיוב יורד בדרך כלל מחשבון הבנק בתאריך זה.',
  },
  {
    title: 'מסלול',
    explanation:
      'מערכת תנאים שמגדירה כיצד מוצר פיננסי מתנהל לאורך זמן. המסלול יכול לקבוע ריבית, תקופה, הצמדה, עמלות או כללי שימוש.',
    example:
      'לדוגמה: שני מסלולים לאותו מוצר יכולים להיות שונים בשיעור הריבית, במשך התקופה ובאופן שבו התשלום משתנה.',
  },
  {
    title: 'מועדון',
    explanation:
      'שיוך של כרטיס אשראי לקבוצת לקוחות, ארגון או תוכנית הטבות. המועדון עשוי להציע הנחות והטבות בתנאים ובבתי עסק מוגדרים.',
    example:
      'לדוגמה: כרטיס המשויך למועדון מסוים עשוי להעניק הנחה אצל שותפי המועדון, בכפוף לתנאי ההטבה.',
  },
] as const;

export function GlossaryScreen(): React.ReactElement {
  const { t } = useTranslation();
  const [expandedTerms, setExpandedTerms] = useState<readonly string[]>([]);

  function toggleTerm(title: string): void {
    setExpandedTerms(current =>
      current.includes(title)
        ? current.filter(expandedTitle => expandedTitle !== title)
        : [...current, title],
    );
  }

  return (
    <RtlScreen className={`${SURFACE.page}`}>
      <RtlScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
        <View className="w-full gap-4 px-4 py-6">
          <AppText
            className={`text-2xl font-extrabold ${TEXT.heading}`}
          >
            {t('מילון פיננסי')}
          </AppText>
          <AppText
            className={`mb-1 text-sm leading-6 ${TEXT.secondary}`}
          >
            {t(
              'הסברים כלליים למונחים נפוצים. המידע נועד להבנה בלבד ואינו ייעוץ פיננסי.',
            )}
          </AppText>

          {GLOSSARY_TERMS.map((term, index) => {
            const isExpanded = expandedTerms.includes(term.title);
            const englishTerm = en.glossary.terms[index];

            return (
              <View
                className={`w-full rounded-xl border p-4 ${BORDER.subtle} ${SURFACE.card}`}
                key={term.title}
              >
                <AppText
                  className={`text-xl font-extrabold ${ACCENT.text}`}
                >
                  {t(term.title, undefined, englishTerm?.title)}
                </AppText>
                <AppText
                  className={`mt-2 text-base leading-7 ${TEXT.body}`}
                >
                  {t(
                    term.explanation,
                    undefined,
                    englishTerm?.explanation,
                  )}
                </AppText>

                <Pressable
                  accessibilityLabel={`${t('כיצד זה משפיע עליך?')} — ${t(term.title, undefined, englishTerm?.title)}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isExpanded }}
                  className={`mt-3 min-h-[48px] items-center justify-center rounded-lg border px-4 ${ACCENT.borderSubtle} ${ACCENT.surface}`}
                  onPress={(): void => toggleTerm(term.title)}
                >
                  <AppText
                    className={`text-center text-base font-extrabold ${ACCENT.text}`}
                  >
                    {t('כיצד זה משפיע עליך?')}
                  </AppText>
                </Pressable>

                {isExpanded ? (
                  <View className={`mt-3 rounded-lg p-3 ${SURFACE.sunken}`}>
                    <AppText
                      className={`text-sm leading-6 ${TEXT.body}`}
                    >
                      {t(term.example, undefined, englishTerm?.example)}
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </RtlScrollView>
    </RtlScreen>
  );
}
