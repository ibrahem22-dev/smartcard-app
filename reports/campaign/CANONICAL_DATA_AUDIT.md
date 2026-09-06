# CANONICAL DATA AUDIT

Derived from the shipped packs by `tools/campaign-data-audit.mjs`. Every figure is counted
from the same bytes the application reads.

## SECTION 26 — DATASET TOTALS

| measure | count |
| --- | ---: |
| canonical card products (all lifecycles) | 474 |
| CURRENT + selectable products (what Add Card offers) | 378 |
| RETIRED products | 56 |
| TARIFF_ONLY_NOT_PROVEN_CURRENT | 25 |
| EXCLUDED_FROM_PRODUCT_COUNT | 15 |
| shipping organisations | 18 |
| — of which BANK | 14 |
| — of which CARD_COMPANY | 4 |
| payment networks | 5 |
| clubs | 123 |
| programmes | 211 |
| card-to-programme edges | 135 |
| CURRENT products carrying a programme edge | 72 |
| CURRENT products with NO programme edge | 306 |
| tariff fee rows | 1090 |
| — CARD_FEE rows | 579 |
| — scope ALL_CARDS_OF_OPERATOR_AT_ISSUER (bindable) | 828 |
| — scope ISSUER_WIDE (bindable) | 55 |
| — scope NAMED_CARD_OR_LEVEL (NOT bindable — see gaps) | 207 |
| waiver rules | 171 |
| card-level fee exceptions (already applied by the pipeline) | 14 |
| products with a VERIFIED per-card FX commission | 378 |
| products with a VERIFIED per-card foreign-ATM percentage | 378 |
| products with a published same-currency ATM fee | 65 |
| products with at least one bindable CARD_FEE candidate | 338 |
| products where exactly ONE distinct CARD_FEE figure is bindable | 14 |
| products with NO bindable CARD_FEE row | 40 |
| total benefits | 700 |
| benefits pinned to at least one card product | 298 |
| distinct products any benefit is pinned to | 64 |
| benefits carrying eligibleMerchantIds | 6 |
| benefits with a validUntil | 34 |
| benefits with a validFrom | 46 |
| benefits with lifecycleStatus RETIRED | 20 |
| benefits with lifecycleStatus CURRENT | 142 |
| benefits carrying a value | 293 |
| benefits with programmeResolution UNRESOLVED_NAMESPACE_DISJOINT | 558 |
| merchants | 266 |
| merchants with a Hebrew name | 189 |
| merchants with an Arabic name | 93 |
| merchant aliases | 413 |
| issuer contact rows | 18 |

### Orphans

- fee rows naming an organisation the issuers unit does not hold: **0**
- benefits naming an organisation the issuers unit does not hold: **0** 
- programme edges from a card the catalog does not hold: **0**
- programme edges to a node neither clubs nor programmes holds: **0**
- benefit card references resolving to no catalog row: **0**

## SECTION 27 — THE FOUR CONSUMER CARD COMPANIES

| org | kind | relationship the data states | CURRENT products | network spellings | programme edges | products with bindable CARD_FEE | products with pinned benefits |
| --- | --- | --- | ---: | --- | ---: | ---: | ---: |
| org:max | CARD_COMPANY | issues its own | 16 | Mastercard / Visa / Visa, Mastercard / NOT_CONFIRMED / Mastercard, Visa | 14 | 16 | 15 |
| org:cal | CARD_COMPANY | issues its own | 24 | Mastercard / Mastercard, Visa / Diners / Mastercard (partially confirmed) / Visa / Diners, Mastercard / Mastercard, Diners | 21 | 24 | 21 |
| org:isracard | CARD_COMPANY | issues its own | 15 | UNKNOWN / MULTI_NETWORK_SEE_VARIANTS / Mastercard / Visa | 0 | 15 | 10 |
| org:amex-il | CARD_COMPANY | issued by org:isracard | 20 | AMERICAN_EXPRESS | 20 | 20 | 0 |

- **org:amex-il join caveat, verbatim:** American Express Israel cards are ISSUED by Isracard Ltd. 'isracard' and 'amex' are NOT disjoint issuers — any filter or join that assumes disjointness is wrong. They nevertheless carry genuinely different fee terms (e.g. FX 2.9% vs 2.5%) and must not be merged into one fee scope.

## SECTION 28 — BANK COVERAGE (the list Add Card actually offers)

| bank | CURRENT products | operators recorded | network spellings | programme edges | bindable CARD_FEE | pinned benefits | unbindable NAMED rows |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| org:discount — בנק דיסקונט לישראל בע"מ | 22 | org:cal | Diners Club / Mastercard / Diners / Diners, Mastercard / Mastercard, Diners / Visa, Mastercard / Visa | 0 | 22 | 0 | 0 |
| org:fibi — הבנק הבינלאומי הראשון לישראל בע"מ | 38 | org:isracard / org:cal / org:max | MASTERCARD | 0 | 38 | 0 | 0 |
| org:hapoalim — בנק הפועלים בע"מ | 42 | (none recorded) / org:amex-il / org:isracard | American Express / Mastercard / Visa | 17 | 15 | 16 | 0 |
| org:jerusalem — בנק ירושלים בע"מ | 13 | (none recorded) | Mastercard / Visa / MASTERCARD | 0 | 13 | 0 | 29 |
| org:leumi — בנק לאומי לישראל בע"מ | 13 | (none recorded) / org:isracard | VISA, MASTERCARD / VISA | 0 | 1 | 0 | 0 |
| org:massad — בנק מסד בע"מ | 26 | org:isracard / org:max | - | 0 | 26 | 0 | 0 |
| org:mercantile — בנק מרכנתיל דיסקונט בע"מ | 21 | org:cal | Diners / DINERS / Diners, Mastercard / Mastercard, Diners / MASTERCARD / Visa, Mastercard / Mastercard / VISA / Visa | 0 | 21 | 0 | 53 |
| org:mizrahi-tefahot — בנק מזרחי טפחות בע"מ | 31 | org:amex-il / org:cal / org:isracard / org:max | AMEX / American Express / Visa / DINERS / Diners Club / Mastercard / ISRACARD_LOCAL / MASTERCARD / VISA | 0 | 31 | 0 | 86 |
| org:one-zero — וואן זירו הבנק הדיגיטלי בע"מ | 2 | org:isracard / (none recorded) | MASTERCARD | 0 | 1 | 1 | 15 |
| org:otsar-hahayal — בנק אוצר החייל בע"מ | 38 | org:isracard / org:cal / org:max | - | 0 | 38 | 0 | 0 |
| org:pagi — בנק פועלי אגודת ישראל בע"מ (פאג"י) | 31 | org:isracard / org:cal | - | 0 | 31 | 0 | 0 |
| org:postal-bank — די.אי. דואר פיננסים בע"מ / בנק הדואר | 8 | (none recorded) / org:isracard | MASTERCARD / ISRACARD_LOCAL / VISA | 0 | 8 | 0 | 24 |
| org:yahav — בנק יהב לעובדי המדינה בע"מ | 18 | org:isracard / org:cal | American Express / Mastercard / Diners Club / Visa | 0 | 18 | 0 | 0 |

Banks shipped but with NO current product, therefore NOT offered: org:union (HISTORICAL_MERGED)

## SECTION 29 — THE DISCOVERY CATEGORIES, AGAINST THE ACTUAL CORPUS

| requested category | canonical taxonomy mapping | merchants in taxonomy | benefit offers linked to those merchants |
| --- | --- | ---: | ---: |
| restaurants | DINING | 12 | 0 |
| cinema / entertainment | ENTERTAINMENT | 8 | 0 |
| 1+1 | no taxonomy category — 1+1 is a benefit SHAPE, not a merchant sector, and the corpus models no such field | 0 | 0 |
| fuel | FUEL | 4 | 0 |
| flights / travel | TRAVEL_AIRLINE / TRAVEL_AGENCY / TRAVEL_HOTEL | 34 | 4 |

Every merchant category the taxonomy models, with its merchant count:

| canonical category | merchants |
| --- | ---: |
| FASHION | 45 |
| GROCERY | 25 |
| OTHER | 21 |
| TRAVEL_AGENCY | 18 |
| CONSUMER_CLUB | 16 |
| FINANCIAL_SERVICES | 13 |
| HOME | 13 |
| DINING | 12 |
| SPORTS_LEISURE | 10 |
| CHILDREN_BABY | 10 |
| PHARMACY_HEALTH_BEAUTY | 10 |
| TRAVEL_AIRLINE | 10 |
| ONLINE_MARKETPLACE | 10 |
| ELECTRONICS | 9 |
| ENTERTAINMENT | 8 |
| TRAVEL_HOTEL | 6 |
| AIRPORT_LOUNGE | 5 |
| PROFESSIONAL_ASSOCIATION | 5 |
| TELECOM | 4 |
| GIFT_CARD_PLATFORM | 4 |
| FUEL | 4 |
| INSURANCE | 3 |
| TRANSPORT | 3 |
| ISSUER_OPERATED_STORE | 2 |

Merchants any benefit in the whole corpus is linked to: **6** — merch:super-pharm, merch:arbitrip, merch:bridgepay, merch:tiktick, merch:tostos, merch:tripzone

Benefit families the app groups the estate benefitType vocabulary into, over the whole corpus:

| family | benefits | of which pinned to a card product |
| --- | ---: | ---: |
| other | 252 | 106 |
| fees | 98 | 52 |
| points | 86 | 30 |
| travel | 59 | 30 |
| cashback | 49 | 30 |
| merchant | 46 | 9 |
| foreign-currency | 36 | 18 |
| lounge | 34 | 16 |
| credit | 30 | 5 |
| insurance | 10 | 2 |

