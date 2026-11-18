# ATM accessibility for blind and visually impaired people in Nigeria

Research note for Pay Alone. Compiled 18 Nov 2026. All sources accessed 18 Nov 2026.

**How this was researched.** Web search only. Direct page fetches failed in this session: `cbn.gov.ng`, `placng.org`, `regalert.today`, `inclusivenews.com.ng` and `adry.up.ac.za` were blocked by the session's network rules (DNS/proxy 403). So most facts below come from search-result extracts of the cited pages, not from reading the full page. Where a claim rests only on news or an extract, it says so. Check every figure at its source before it goes on a slide.

## Summary (10 lines)
1. Nigeria has roughly 16,700 to 17,400 ATMs (CBN H1 2024: 16,714 active; IMF FAS 2025: 17,404), down from a 2019 peak of 19,459. Counts differ by definition; NIBSS-based reports said about 22,500 in Dec 2022.
2. Biggest fleets: Access Bank (over 4,000), First Bank (about 3,300), UBA (about 2,150-2,700), Zenith (2,134 in 2024). Hyosung (via distributor Inlaks, over 10,000 supported) and NCR are the main brands; Diebold Nixdorf is present. No vendor share data is public.
3. The only binding CBN accessibility rule found: 2% of each acquirer's ATMs must have "tactile graphic symbols", locations published online. It dates from 2010, was repeated in 2016/2020, and again in the Oct 2025 draft.
4. No CBN rule requires talking ATMs, headphone jacks, or voice guidance. India required all new ATMs to talk from July 2014; the US from March 2012; the EU from June 2025.
5. Hyosung and NCR sell ATMs with audio jacks and voice guidance, but voice needs software and audio files switched on. A Nigerian report says one bank's accessible ATMs had text-to-speech "not activated".
6. No confirmed voice-guided ATM in service in Nigeria was found. First Bank announced voice-prompt ATMs in Sept 2025 (plan). No ATM in any Nigerian language other than English was found.
7. Banks refuse cards to blind customers or demand indemnity forms, affidavits or court visits (CITAB, Ripples, Fintech Magazine Africa). This pushes people to helpers.
8. Helpers steal: police reports of card swaps on blind victims (Nnewi widow, over N2m; Yobe man, N181,550). NIBSS counts 6,825 card-theft cases in 2023; it has no "card swap" category.
9. The Disabilities Act 2018 bans discrimination and gave a 5-year transition that ended Jan 2024. Enforcement against banks: none found. No Nigerian banking accessibility standard found.
10. Pay Alone can close the "helper at the cash point" gap with an agent cash-out over Open Payments (buildable now on test money) and a cardless-code flow (needs a bank or Interswitch partner).

## 1. Which ATMs, who runs them, how many

### Fleet size and trend
| Figure | Date | Source | Note |
|---|---|---|---|
| 16,714 active ATMs, down from 17,377 in H2 2023 | H1 2024 | CBN data, reported by [TechCabal, 14 Oct 2025](https://techcabal.com/2025/10/14/cbn-one-atm-per-5000-cards-pos-rules-tighten/) | news citing CBN; CBN table not seen |
| 19,459 (peak, 2019) to 17,404 (2025); 12.3 ATMs per 100,000 adults in 2025, from 16.4 in 2019 | 2019-2025 | IMF Financial Access Survey, via [Intelpoint](https://intelpoint.co/insights/nigeria-has-fewer-atms-per-adult-than-at-any-point-since-2012/) and [FRED series NGAFCACNUM](https://fred.stlouisfed.org/data/NGAFCACNUM) | secondary analysis of IMF data |
| About 22,500 (Dec 2022), about 22,600 (Dec 2023) | 2022-23 | [TechCabal, 16 Feb 2024](https://techcabal.com/2024/02/16/whats-next-for-nigerian-atms-as-investment-dries-up/) | likely "deployed" not "active"; conflicts with the rows above |
| 438.6 million ATM transactions in Q1 2026, up 6.6% year on year | Q1 2026 | [BrandSpur](https://brandspurng.com/?p=199790) (news) | primary NIBSS/CBN table not seen |

Trend: the fleet is shrinking while POS agents grow (Intelpoint: [2.9 million more POS deployed in 2024](https://intelpoint.co/insights/nigeria-saw-an-increase-of-2-9-million-deployed-pos-in-2024-following-the-naira-redesign-in-2023/)). The CBN now pushes back: its 13 March 2026 circular requires one ATM per 7,500 cards issued, phased 30% (2026), 60% (2027), 100% (2028), and bans closed ATM networks ([Nairametrics, 14 Mar 2026](https://nairametrics.com/2026/03/14/cbn-mandates-one-atm-per-7500-payment-cards-by-2028/); [BrandSpur, 16 Mar 2026](https://brandspurng.com/2026/03/16/cbn-sets-new-atm-deployment-rules-mandates-one-atm-per-7500-cards-by-2028/)). The Oct 2025 draft said 1 per 5,000; the final ratio is from news, circular text not seen.

### Largest operators (banks)
| Bank | ATMs | Source |
|---|---|---|
| Access Bank | over 4,000 | [TechCabal, Feb 2024](https://techcabal.com/2024/02/16/whats-next-for-nigerian-atms-as-investment-dries-up/) |
| First Bank | about 3,300 (older reports: 2,700-2,897) | same; [Tribune](https://tribuneonlineng.com/firstbank-atms-dispense-n2-8-trillion-2/) |
| UBA | 2,150 (TechCabal) / 2,209+ (2025) / 2,676 (Intelpoint) | sources disagree |
| Zenith | 2,102 (2023) to 2,134 (2024), about 12.7% of the national fleet | [Nairametrics, 28 Mar 2025](https://nairametrics.com/2025/03/28/zenith-bank-grows-pos-terminals-to-475524-and-issues-27-9-million-atm-cards-in-2024/) (from Zenith's annual report) |

Bank annual reports themselves were not read. Treat these as approximate.

### Manufacturers and models
- **Hyosung (Korea), through Inlaks.** Inlaks is Hyosung's sole Nigerian distributor since 2013. It grew from 300 supported ATMs (Jan 2013) to over 10,000 (Aug 2022) across 23 banks ([BusinessDay, 18 Nov 2022, via PressReader](https://www.pressreader.com/nigeria/business-day-nigeria/20221118/281715503610436)); "over 11,000 sold in 10 years" and leader in ATM sales as of Dec 2022 ([ThisDay, 26 Jan 2023](https://www.thisdaylive.com/2023/01/26/role-of-atms-pos-in-cashless-policy/)). Self-reported by the distributor. Inlaks introduced Hyosung fingerprint ATMs in March 2015 for BVN ([Guardian](https://guardian.ng/?p=840318); [Nigeria CommunicationsWeek](https://www.nigeriacommunicationsweek.com.ng/inlaks-unveils-fingerprint-atms-in-nigeria)). Models sold in Nigeria: unconfirmed (Inlaks launched "new ATM models" in 2019, [ThisDay](https://www.thisdaylive.com/2019/01/10/inlaks-launches-new-atm-models-to-boost-cashless-initiative)).
- **NCR (ATM business now NCR Atleos).** Access Bank bought NCR SelfServ 34 cash-deposit and dual-dispenser ATMs in 2016 ([NCR Atleos news](https://ncratleos.com/news/access-bank-adds-new-multi-function-cash-deposit)). A Nigerian report calls NCR and Wincor Nixdorf the two major brands ([Nigeria CommunicationsWeek](https://www.nigeriacommunicationsweek.com.ng/?p=33609)); date unconfirmed. No 2024-2026 Nigerian NCR Atleos deal found.
- **Diebold Nixdorf (incl. former Wincor Nixdorf).** Union Bank bought 120 Diebold Opteva 520 ATMs in 2008 ([ATM Marketplace](https://www.atmmarketplace.com/news/diebold-wins-contract-with-union-bank/)). Current Nigerian fleet: unconfirmed.
- **GRG and others.** No evidence of GRG ATMs in Nigerian banks was found. Unconfirmed.
- **Vendor market share in Nigeria:** not public. Ken Research lists NCR, Diebold Nixdorf, Wincor Nixdorf, Interswitch and AFS as leading managed-service players, without shares ([Ken Research](https://www.kenresearch.com/industry-reports/nigeria-atm-managed-services-market)).
- **Software stacks:** not documented publicly for Nigeria. Industry-typical is Windows (IoT/Embedded) plus the CEN/XFS device layer and vendor or multi-vendor application software, driven by switches such as Interswitch and NIBSS. This is general industry knowledge, unconfirmed for Nigerian banks.

## 2. Accessibility capabilities

### What the machines can do (manufacturers)
- **Hyosung**: brochures for current models (MX5400, MX7800, MX8800, Halo II, 8TA, MV800) list "ADA audio guidance" through an earphone jack, some with a voice interface option ([Hyosung Hero MX5400 brochure](https://hyosungamericas.com/wp-content/uploads/2024/11/Hyosung-Hero-MX5400-Brochure-US.pdf); [Hyosung 8TA brochure](https://hyosung-tns.com/wp-content/uploads/sites/8/2026/01/Hyosung-8TA-Brochure.pdf)). These are US/global brochures; whether Nigerian units ship with audio enabled is unconfirmed.
- **NCR**: offers voice guidance with a headset jack, raised keypad features, "PIN on glass"; voice needs NCR software and a pre-recorded audio file per screen ([Finextra, NCR adds accessibility features](https://www.finextra.com/newsarticle/7403/ncr-adds-accessibility-features-to-atms); [Finextra, audio-enabled US shipments](https://finextra.com/newsarticle/2502/ncr-commits-to-audio-enabled-atms-for-us-shipments)). NCR's Indian accessible ATM used a raised 5 instead of Braille ([American Banker](https://www.americanbanker.com/payments/news/ncr-joins-two-indian-organizations-to-launch-atm-for-the-blind)).
- **Key point:** a headphone jack is hardware. Speech is a per-bank software project (scripts, audio for each screen, each language). A jack can sit on a machine and do nothing. UK reports describe exactly this ([Sight and Sound](https://www.sightandsound.co.uk/?p=11581)).

### Features, and their Nigerian status
| Feature | Exists on vendor hardware | In Nigeria |
|---|---|---|
| Audio jack + voice guidance | yes (above) | no confirmed live deployment; one bank's accessible ATMs had TTS "not activated" ([Ripples Nigeria](https://www.ripplesnigeria.com/feature-marginalised-defrauded-how-nigerian-banks-shut-out-visually-impaired-customers-from-atms/)) |
| Voice in Pidgin, Yoruba, Hausa, Igbo | technically possible | none found |
| Raised dot on 5, tactile keys | standard on most EPPs | likely common, unverified; CBN rule only requires "tactile graphic symbols" on 2% |
| Braille labels | yes | CITAB says still missing ([search extract of Inclusive News](https://inclusivenews.com.ng/centre-slams-cbns-atm-accessibility-guidelines-as-inadequate-for-the-blind/)) |
| High contrast / large text | yes | First Bank announced it, Sept 2025 ([Nairametrics, 24 Sep 2025](https://nairametrics.com/2025/09/24/firstbank-set-to-launch-tailored-financial-services-for-blind-and-physically-challenged-customers/)); rollout unconfirmed |
| Cardless (Paycode, USSD) | yes | exists: Verve/Interswitch Paycode adopted by 13 banks ([TheCable](https://www.thecable.ng/13-banks-adopt-verves-paycode-cardless-transactions)); GTBank *737, Zenith *966 codes per blogs (unverified) |
| Contactless / NFC withdrawal | yes | First Bank FastTrack touchless ATM, 2020, with Inlaks/Hyosung ([DMarketForces](https://dmarketforces.com/firstbank-launches-touchless-automated-teller-machine-in-nigeria/)); scale unknown |
| Fingerprint ATMs | yes | Hyosung fingerprint ATMs via Inlaks since 2015; use for withdrawal today unconfirmed |

**Interswitch Paycode.** A one-time code ("token") generated on an issuing channel, then entered at the ATM. Interswitch's developer docs show a token lifetime field (`tokenLifeTimeInMinutes`, 60 in the sample) and a one-time PIN ([Interswitch docs: Cardless services](https://docs.interswitchgroup.com/docs/cardless-services); [Single Paycode](https://docs.interswitchgroup.com/docs/single-paycode)). A 2014 launch report gave limits of N1,000-N20,000 in multiples of N1,000 ([Mobile Money Africa](https://mobilemoneyafrica.com/blog/nigeria-interswitch-unveils-card-less-atm-withdrawals)); current limits unconfirmed. Works on some banks' ATMs, not all ([Techpoint](https://techpoint.africa/general/verve-paycode-cardless-atm-withdrawal/)).

### Comparison: talking ATMs elsewhere
| Place | Rule | Source |
|---|---|---|
| USA | 2010 ADA Standards s.707: speech output, private listening, volume, repeat/interrupt, tactile 5 key, Braille instructions to start speech. Published 15 Sep 2010, compliance from 15 Mar 2012 | [ADA s.707 text (corada mirror)](https://www.corada.com/documents/2010ADAStandards/707); [Duane Morris alert](https://www.duanemorris.com/alerts/mandatory_ADA_standards_on_accessibility_ATMs_visually_impaired_now_in_effect_4437.html) |
| India | RBI 2009: one-third of new ATMs talking with Braille keypads. RBI May 2014: all new ATMs from 1 July 2014 talking with Braille keypads; banks to plan retrofits. Only about 6,000 of 160,000 ATMs talked in 2014 | [RBI notification](https://website.rbi.org.in/web/rbi/-/notifications/need-for-bank-branches-atms-to-be-made-accessible-to-persons-with-disabilities-8936); [Business Standard, May 2014](https://www.business-standard.com/article/finance/make-all-new-atms-talking-ones-from-july-rbi-to-banks-114052101373_1.html); [XRCVC to RBI, Apr 2014](https://www.xrcvc.org/docs/xrcvc-representation-to-rbi-april-2014.pdf) |
| EU | European Accessibility Act (Directive 2019/882) covers ATMs from 28 June 2025; terminals already in use may stay to end of economic life, up to 20 years (verify Art. 32) | [EU Your Europe](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/accessibility/index_en.htm); [Bird & Bird](https://www.twobirds.com/en/insights/2025/european-accessibility-act-focus-on-financial-services) |
| UK | No ATM-specific law found; RNIB campaign found fewer than 70 of 64,000 ATMs could talk (c. 2011); later "over 10,000"; Barclays first with audio ATMs | [Wikipedia: Talking ATM](https://en.wikipedia.org/wiki/Talking_ATM) (tertiary); [ATM Marketplace](https://www.atmmarketplace.com/news/barclays-first-in-uk-with-audio-enabled-atms/) |

Lesson for Nigeria: even with a mandate, India and the UK moved slowly and banks passed off Braille stickers as compliance (XRCVC). Nigeria has no mandate at all.

## 3. Limitations in practice in Nigeria
- **Talking ATMs: not deployed as far as can be found.** First Bank's voice-assisted ATMs were "still in the planning stage" in early 2026 ([Ripples Nigeria](https://www.ripplesnigeria.com/feature-marginalised-defrauded-how-nigerian-banks-shut-out-visually-impaired-customers-from-atms/), news). An Anvaya blog says Ecobank "committed" to voice prompts nationwide ([Anvaya](https://www.anvayafeats.org/post/the-fintech-accessibility-crisis-how-nigeria-s-banking-apps-lock-out-blind-entrepreneurs)); no confirmation found. Unconfirmed either way.
- **Languages:** no ATM voice or screen in Pidgin, Yoruba, Hausa or Igbo found. Unconfirmed.
- **Card refusal pushes people to helpers.** Banks refused cards or demanded indemnity forms naming someone else to use the ATM (First Bank), a court visit (First Bank Surulere), or denied outright (Union Bank Ogbomoso) ([Fintech Magazine Africa, 7 Oct 2025](https://fintechmagazine.africa/2025/10/07/ubas-braille-banking-promise-remains-out-of-reach-for-many-blind-customers/); [Guardian: CITAB accuses banks](https://guardian.ng/news/citab-accuses-banks-of-discrimination-against-blind-customers/); [BONews](https://bonewssng.com/financial-exclusion-new-generation-banks-shun-disability-act-discrimate-against-blind-persons/)). Jaiz Bank reportedly confirmed it requires a court affidavit to open an account for a blind person ([DPI Africa / search extract](https://dpi.africa/left-behind-how-nigerias-banks-are-failing-persons-with-disabilities/)).
- **Helper and card-swap fraud.** Nnewi: a visually impaired widow lost over N2m after a woman "offered to help" and swapped her card; CCTV showed the swap ([Legit.ng](https://www.legit.ng/nigeria/1631611-visually-impaired-widow-falls-victim-atm-fraud-anambra); [Ripples](https://ripplesnigeria.com/visually-impaired-widow-loses-over-n2m-as-suspected-fraudster-swaps-atm-card-in-anambra)). Yobe: a visually impaired man lost N181,550; syndicate held 47 cards ([Peoples Gazette](https://gazettengr.com/yobe-police-arrest-atm-fraud-syndicate-recover-47-cards/)). Kaduna: 10-year sentence for swapping 48 cards "under the pretence of helping" ([Sahara Reporters, 12 Jan 2024](https://saharareporters.com/2024/01/12/court-jails-nigerian-10-years-fraudulently-swapping-48-atm-cards-bank-customers-kaduna)). The NCPWD Executive Secretary has said visually impaired customers often fall victim when forced to rely on third parties (search extract; original page not identified).
- **Official fraud data.** NIBSS 2023: ATM-channel fraud fell 64% vs 2022; card theft 6,825 cases, N658.8m; social engineering 62,901 cases, N8.03bn ([NIBSS 2023 Annual Fraud Landscape](https://nibss-plc.com.ng/wp-content/uploads/2024/04/2023-Annual-Fraud-Landscape.pdf)). NIBSS has no "card swap" or "victim with disability" category, so helper fraud is invisible in the data.
- **Shoulder-surfing / PIN sharing:** no Nigerian numbers found. Structural: a blind user who cannot shield the keypad or hear private audio must speak or hand over the PIN.
- **POS agents.** Agents filled the 2023 cash gap, charging up to 10% ([Techpoint, Feb 2023](https://techpoint.africa/2023/02/07/nigeria-is-not-ready-for-a-cashless-economy/)); they often do no identity checks ([Guardian](https://guardian.ng/?p=2491231)). No source found on agents defrauding blind customers specifically. Unconfirmed.
- **Failed dispenses and disputes.** CBN refunded N115.45bn on failed transactions 2013-2023 from 35,453 complaints ([Nairametrics](https://nairametrics.com/?p=525132), news). New rule: on-us failures reversed instantly, manual within 24h; not-on-us within 48h (13 Mar 2026 circular, per [BusinessDay](https://businessday.ng/news/article/cbn-orders-banks-to-reverse-failed-atm-transactions-immediately/)). A blind user cannot read a receipt or screen to prove a short dispense.
- **Cash scarcity.** The 2022-23 naira redesign capped ATM withdrawals at N20,000/day (own bank) and caused long queues and ATM downtime ([TechCabal, 28 Mar 2023](https://techcabal.com/2023/03/28/naira-redesign-a-torturous-vanity-project-comes-to-an-end/); [Techpoint](https://techpoint.africa/2023/02/07/nigeria-is-not-ready-for-a-cashless-economy/)). Queues are hardest on those who need help and cannot stand long.
- **Apps.** Association for the Blind survey of 10 banks: most apps largely unusable for blind users (method and date not given) ([Vanguard, Jan 2026](https://www.vanguardngr.com/2026/01/how-failures-in-payment-pillars-infrastructure-lock-out-people-with-disabilities/); [AllAfrica, Sep 2024](https://allafrica.com/stories/202409180078.html)).

## 4. Regulation
- **CBN Standards and Guidelines on ATM Operations (April 2010).** "2% of ATMs deployed shall have tactile graphic symbol for the use of visually impaired customers", to be complied with within five years ([CBN PDF](https://www.cbn.gov.ng/out/2010/circulars/bspd/atm%20standards%201.pdf); seen as search extract, PDF fetch blocked). Ripples says banks missed this deadline by 10 years.
- **CBN Guidelines on Operations of Electronic Payment Channels (2016, revised 2020).** Repeat: 2% of each acquirer's ATMs with tactile graphic symbols, locations published on their website "at the minimum" ([2020 PDF on CBN](https://www.cbn.gov.ng/out/2020/ccd/reviewed%20and%20approved%20guidelines%20on%20operations%20of%20electronic%20payment%20channels%20in%20nigeria%202020.pdf); [copy on NIBSS](https://nibss-plc.com.ng/wp-content/uploads/2023/03/Approved-Guidelines-on-Operations-of-Electronic-Payment-Channels-in-Nige1.pdf); [2016 PDF](https://www.CBN.gov.ng/Out/2016/BPSD/Approved%20Guidelines%20on%20Operations%20of%20Electronic%20Payment%20Channels%20in%20Nigeria.pdf)).
- **Draft Guidelines on the Operations of ATMs (9 Oct 2025).** Keeps the 2% tactile rule and adds "accessibility and inclusivity" wording; proposes instant/48h refunds ([CBN draft PDF](https://www.cbn.gov.ng/Out/2025/CCD/DRAFT%20GUIDELINES%20ON%20THE%20OPERATIONS%20OF%20AUTOMATED%20TELLER%20MACHINES%20(ATMs)%20IN%20NIGERIA%2009102025.pdf); [Afriwise](https://www.afriwise.com/blog/the-cbns-draft-guidelines-on-atm-operations-emerging-compliance-and-regulatory-trends-in-nigerias-banking-landscape); [EFInA, 28 Nov 2025](https://efina.org.ng/2025/11/28/cbn-2025-draft-guidelines-on-the-operations-of-atms-in-nigeria-misconceptions-and-realities/)). CITAB called it "a token gesture" and asked for binding anti-discrimination directives and a disability help desk.
- **13 March 2026 circular (final ATM rules).** Density 1:7,500 cards by 2028, instant reversal, interoperability, biometric fallback ([Nairametrics](https://nairametrics.com/2026/03/14/cbn-mandates-one-atm-per-7500-payment-cards-by-2028/); [BusinessDay](https://businessday.ng/news/article/cbn-orders-banks-to-reverse-failed-atm-transactions-immediately/)). Whether the final text keeps the 2% tactile rule or adds anything for disability: **unconfirmed**.
- **CBN Consumer Protection Regulations (2019).** Institutions must "accord special consideration to the needs of vulnerable groups, especially the physically challenged persons and seniors" ([CBN PDF](https://www.cbn.gov.ng/out/2019/ccd/cbn%20consumer%20protection%20regulations.pdf), extract). Disclosure guidelines cover a consumer who is "illiterate or blind" (s.4.1.2.2, [draft disclosure guidelines](https://www.cbn.gov.ng/out/2019/ccd/draft%20guidelines%20on%20%20disclosure%20and%20transparency%20(002).pdf)). The Dec 2023 exposure draft of revised regulations adds s.4.1.4: support consumers with "special needs such as multilingual assistance, disabilities" ([CBN exposure draft](https://www.cbn.gov.ng/Out/2024/CCD/EXPOSURE%20DRAFT%20REVISED%20CONSUMER%20PROTECTION%20REGULATIONS%202.0.pdf)); final status unconfirmed. Earlier: [Consumer Protection Framework 2016](https://www.cbn.gov.ng/out/2016/cfpd/consumer%20protection%20framework%20(final).pdf).
- **Discrimination Against Persons with Disabilities (Prohibition) Act 2018** (signed Jan 2019, [HRW, 25 Jan 2019](https://www.hrw.org/news/2019/01/25/nigeria-passes-disability-rights-law)). Bans discrimination on grounds of disability (s.1, per news extracts). Section 6 gives a 5-year transitory period to modify public buildings and structures ([Act text, PLAC](https://placng.org/i/wp-content/uploads/2020/07/The-Discrimination-Against-Persons-with-Disabilities-Prohibition-Act.pdf), fetch blocked; [ILO NATLEX entry](https://natlex.ilo.org/dyn/natlex2/r/natlex/fe/details?p3_isn=112595)). That period ended January 2024 ([Inclusive News](https://inclusivenews.com.ng/agency-pledges-stronger-support-as-ncpwd-pushes-for-full-enforcement-of-disability-act/)). No section specific to banks or ATMs was found; the Act does not mention digital accessibility (per news). Exact section numbers beyond s.1 and s.6: unconfirmed.
- **National Commission for Persons with Disabilities (NCPWD).** Created by the Act. Has threatened to seal inaccessible organisations ([TheCable](https://www.thecable.ng/ncpwd-threatens-to-seal-organisations-not-accessible-to-pwds/)) and launched a National Certificate of Compliance in Sept 2025 ([Inclusive News](https://inclusivenews.com.ng/nigeria-unveils-national-certificate-of-compliance-to-advance-disability-inclusion/)). CITAB asked why NCPWD has not acted on banks ([Guardian](https://guardian.ng/news/citab-accuses-banks-of-discrimination-against-blind-customers/)). No NCPWD action against a bank found.
- **Published accessibility standard for Nigerian banking:** none found.
- **Enforcement:** weak. House of Representatives complained of non-implementation in Oct 2024 ([AllAfrica](https://allafrica.com/stories/202410150658.html)). Lawsuits found (UBA in Lagos over an ATM injury; Access, GTB, Zenith over mantrap doors) have no reported outcome ([Inclusive News](https://inclusivenews.com.ng/87654-21/); [Leadership](https://leadership.ng/people-with-disabilities-sue-banks-over-inaccessible-doors-facilities/)).
- **CBN's own framing (Sept 2026):** about 40 million Nigerians with disabilities, an underserved market; fintechs urged to build for them ([Nairametrics, 25 Sep 2026](https://nairametrics.com/2026/09/25/cbn-identifies-40-million-nigerians-with-disabilities-as-untapped-fintech-market/)). Not a census figure.

## 5. Evidence of blind people's experience
| Evidence | Type | Numbers | Source |
|---|---|---|---|
| Financial inclusion of PWDs, CBN Bullion vol 42 iss 4 | peer-reviewed (CBN journal) | inclusion differs by zone; high for mobile banking, low for other services; recommends Braille, large fonts, contrast so users need no third party | [CBN Bullion](https://dc.cbn.gov.ng/bullion/vol42/iss4/6) (abstract only) |
| E-banking for visually impaired, Oyo State | academic survey | 185 respondents; barriers: no audio guidance, cannot use ATMs alone | [Academia.edu](https://www.academia.edu/172607462/Challenges_and_Prospects_of_E_banking_System_for_Persons_with_Visual_Impairment_in_Oyo_State_Nigeria) (authors, year unconfirmed) |
| Financial services and PWDs in Nigeria; CRPD, 2018 Act, five CBN instruments | peer-reviewed law article, 2024 | compliance assessment (detail not read) | [African Disability Rights Yearbook 2024, Ofuani-Sokolo and Monye](https://www.adry.up.ac.za/section-a-2024/ofuani-sokolo-ai-monye-o) (fetch blocked) |
| Association for the Blind survey of 10 banks | NGO | most apps unusable; buttons unlabeled; biometrics need sighted help | Vanguard Jan 2026; AllAfrica Sep 2024 (above) |
| CITAB complaints | NGO | named banks: First, Wema, Access, Ecobank, Fidelity, Unity, Union, Keystone | [Guardian](https://guardian.ng/news/citab-accuses-banks-of-discrimination-against-blind-customers/); [Inclusive News](https://inclusivenews.com.ng/group-accuses-nigerian-banks-of-discriminatory-practices-against-visually-impaired-customers/) |
| Card swaps on blind victims | police / news | over N2m (Nnewi); N181,550 (Yobe) | above |
| Nigeria Association of the Blind (youth secretary) | NGO quote | banks should upgrade machines, not deny ATM use | Ripples (above) |

No JONAPWD report on ATMs and no EFInA disability breakdown were found. No national survey number on how many blind Nigerians use ATMs alone was found. For contrast, an RNIB UK survey said 11% of visually impaired people use ATMs independently (search extract, [Silversurfers](https://silversurfers.com/financial/audio-technology-for-3000-atms)).

## Gaps Pay Alone can close
| Gap found | Who it hurts | What Pay Alone does | Status |
|---|---|---|---|
| ATMs do not talk; voice needs bank software nobody switched on | blind, non-reading | voice is on the customer's own phone, in English, Pidgin, Yoruba, Hausa | voice built; ATM link is a proposal |
| No Nigerian language on ATMs | non-reading, elderly | multilingual live voice | built; native-speaker check pending |
| Helper learns the PIN or swaps the card | blind, elderly | no card, no PIN: fingerprint on own device approves | built for payments; for cash, proposal |
| Banks refuse cards to blind people | blind | wallet works without a card | built (test wallet) |
| Cannot verify a short dispense or a receipt | blind | amount read from the quote and the receiver's confirmation | built for payments; cash count not solved |
| Unlimited loss once a helper has card + PIN | all | weekly cap enforced by the wallet's grant | built (test wallet) |
| Cash scarcity, queues | all | pay sellers directly, less need for cash | built (test wallet) |

## Proposed solutions (proposals, not working features)

### A. Agent cash-out with voice read-back (buildable now on test money)
How it works:
1. Customer says "I want 5,000 naira cash" to a POS agent or shop that runs the Pay Alone seller app.
2. Agent enters the customer's pay code and the amount plus fee. Agent app creates an Open Payments incoming payment.
3. Customer's phone hears the request. Pay Alone quotes it and reads back the exact debit from the quote: "Mama Ade Cash Point asks 5,100 naira: 5,000 cash and 100 fee."
4. Customer approves with their fingerprint. The weekly cap applies.
5. Agent app polls the incoming payment, sees it received, and hands over cash.
6. Customer's phone says: "Mama Ade's wallet confirmed 5,100 received. You should get 5,000 naira in cash."

Open Payments today: incoming payment, quote, grant with limits, outgoing payment, polling. All already used by Pay Alone. Needs a partner: a real agent network and a real Nigerian wallet on Open Payments (none yet). Cash itself is off-protocol.
Buildable now: yes, as a "cash out" label on the existing seller flow, on the test wallet. Must be labelled simulated where cash is shown.
Risks: the agent can hand over less cash; a blind user cannot count notes alone (phone note-recognition is a separate, unbuilt idea). No refund API in Open Payments, so a dispute is off-protocol. Agent fee abuse. Agent banking rules and KYC apply in real life.

### B. Fingerprint-approved one-time cardless code at an ATM (needs a bank or Interswitch partner)
How it works:
1. Customer says "Get 10,000 naira from the ATM."
2. Pay Alone asks the bank/Interswitch to issue a one-time cardless code (Paycode-style) for that amount; the debit is shown and spoken from the issuer's response.
3. Customer approves with their fingerprint. No PIN is typed into the phone or told to anyone.
4. The phone speaks the code privately through earphones, one digit at a time, with "say again".
5. At the ATM the customer picks the cardless option and enters the code on the tactile keypad. Code expires (Interswitch's sample: 60 minutes) and works once.

Open Payments today: cannot do this. It has no cash-out, no code issuance, no ATM link. A Pay Alone outgoing payment could fund a partner's wallet, but that partner must issue the code.
Needs: Interswitch Paycode API access ([docs](https://docs.interswitchgroup.com/docs/cardless-services)) or a bank cardless API, plus that bank's ATMs. Buildable now: only a clearly SIMULATED demo of steps 1-4.
Risks: a helper who stands close can still hear or watch the code; the ATM menu still has to be found without speech; codes may be refused by other banks' ATMs; fees and limits unknown; no partner yet.

### C. The phone as the ATM's voice (guidance only; later a bank partner)
How it works:
1. Customer stands at an ATM and says "Help me use this ATM."
2. Pay Alone, through earphones, talks them through the known cardless flow for that bank: where the slot and keypad are, which side key picks "Cardless", when to enter the code, where the cash comes out, "count before you leave."
3. After the session, the phone checks whether the withdrawal posted (needs the bank) and helps raise a dispute if not.

Open Payments today: not involved. Needs: verified screen scripts per bank and ATM model (only the bank has them). The ideal version uses ATM events from the bank in real time, which no Nigerian bank offers publicly.
Buildable now: a spoken script for one flow, marked as guidance and unverified. Not recommended for the demo: wrong guidance could cost money.
Risks: menus change and differ by model; the phone cannot see the screen; it encourages cash use rather than direct payment.

Recommendation for the hackathon: show A on test money (it is the existing journey, honestly labelled), mention B as the partner roadmap. Skip C in the demo.

## Open questions / unconfirmed
1. Does the final 13 March 2026 CBN ATM text keep the 2% tactile rule or add anything for disability? Circular not read.
2. Exact ATM counts: CBN active vs NIBSS deployed vs IMF. Which one the CBN uses officially.
3. Vendor shares in Nigeria; GRG presence; models and software (XFS, multi-vendor software) in Nigerian banks.
4. Is any voice-guided ATM switched on in Nigeria today (First Bank, Ecobank, others)?
5. Current Paycode limits, fees and which ATMs accept it; whether Interswitch gives sandbox API access to students.
6. Exact text of Disabilities Act 2018 ss.1 and 6 and any section on services; PLAC PDF not read.
7. Whether the CBN Consumer Protection Regulations 2.0 (s.4.1.4 special needs) are final.
8. Authors and year of the Oyo State study; full CBN Bullion paper; ADRY 2024 article findings.
9. Any NCPWD action against a bank; outcome of the UBA and mantrap-door suits.
10. Real agent banking rules for a Pay Alone-style cash-out; whether a non-bank can do it.
11. The NCPWD Executive Secretary quote on fraud through helpers: original page not identified.

## Sources
All accessed 18 Nov 2026. Publication dates given where known. "extract" = only search-result extract seen.

Primary / official
- CBN, Standards and Guidelines on ATM Operations, Apr 2010 (extract): https://www.cbn.gov.ng/out/2010/circulars/bspd/atm%20standards%201.pdf
- CBN, Guidelines on Operations of Electronic Payment Channels, 2016: https://www.CBN.gov.ng/Out/2016/BPSD/Approved%20Guidelines%20on%20Operations%20of%20Electronic%20Payment%20Channels%20in%20Nigeria.pdf
- CBN, same, revised 2020: https://www.cbn.gov.ng/out/2020/ccd/reviewed%20and%20approved%20guidelines%20on%20operations%20of%20electronic%20payment%20channels%20in%20nigeria%202020.pdf (NIBSS copy: https://nibss-plc.com.ng/wp-content/uploads/2023/03/Approved-Guidelines-on-Operations-of-Electronic-Payment-Channels-in-Nige1.pdf)
- CBN, Draft Guidelines on Operations of ATMs, 9 Oct 2025 (extract): https://www.cbn.gov.ng/Out/2025/CCD/DRAFT%20GUIDELINES%20ON%20THE%20OPERATIONS%20OF%20AUTOMATED%20TELLER%20MACHINES%20(ATMs)%20IN%20NIGERIA%2009102025.pdf
- CBN, Consumer Protection Regulations 2019 (extract): https://www.cbn.gov.ng/out/2019/ccd/cbn%20consumer%20protection%20regulations.pdf
- CBN, Exposure draft revised Consumer Protection Regulations, Dec 2023 (extract): https://www.cbn.gov.ng/Out/2024/CCD/EXPOSURE%20DRAFT%20REVISED%20CONSUMER%20PROTECTION%20REGULATIONS%202.0.pdf
- CBN, Consumer Protection Framework 2016: https://www.cbn.gov.ng/out/2016/cfpd/consumer%20protection%20framework%20(final).pdf
- CBN Bullion, financial inclusion of PWDs (abstract): https://dc.cbn.gov.ng/bullion/vol42/iss4/6
- Disabilities Act 2018 text (PLAC, not read): https://placng.org/i/wp-content/uploads/2020/07/The-Discrimination-Against-Persons-with-Disabilities-Prohibition-Act.pdf ; ILO NATLEX: https://natlex.ilo.org/dyn/natlex2/r/natlex/fe/details?p3_isn=112595
- NIBSS, 2023 Annual Fraud Landscape, Apr 2024: https://nibss-plc.com.ng/wp-content/uploads/2024/04/2023-Annual-Fraud-Landscape.pdf
- Interswitch developer docs, Cardless services / Single Paycode: https://docs.interswitchgroup.com/docs/cardless-services ; https://docs.interswitchgroup.com/docs/single-paycode
- IMF FAS via FRED: https://fred.stlouisfed.org/data/NGAFCACNUM
- RBI notification on accessible branches/ATMs: https://website.rbi.org.in/web/rbi/-/notifications/need-for-bank-branches-atms-to-be-made-accessible-to-persons-with-disabilities-8936
- US 2010 ADA Standards s.707 (mirror): https://www.corada.com/documents/2010ADAStandards/707
- EU, accessibility requirements (EAA): https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/accessibility/index_en.htm
- Hyosung brochures: https://hyosungamericas.com/wp-content/uploads/2024/11/Hyosung-Hero-MX5400-Brochure-US.pdf ; https://hyosung-tns.com/wp-content/uploads/sites/8/2026/01/Hyosung-8TA-Brochure.pdf
- NCR Atleos, Access Bank SelfServ ATMs (2016): https://ncratleos.com/news/access-bank-adds-new-multi-function-cash-deposit

Academic / NGO
- Ofuani-Sokolo and Monye, ADRY 2024 (not read): https://www.adry.up.ac.za/section-a-2024/ofuani-sokolo-ai-monye-o
- Oyo State e-banking study (extract): https://www.academia.edu/172607462/Challenges_and_Prospects_of_E_banking_System_for_Persons_with_Visual_Impairment_in_Oyo_State_Nigeria
- XRCVC representation to RBI, Apr 2014: https://www.xrcvc.org/docs/xrcvc-representation-to-rbi-april-2014.pdf
- EFInA on the 2025 draft ATM guidelines, 28 Nov 2025: https://efina.org.ng/2025/11/28/cbn-2025-draft-guidelines-on-the-operations-of-atms-in-nigeria-misconceptions-and-realities/
- Human Rights Watch, 25 Jan 2019: https://www.hrw.org/news/2019/01/25/nigeria-passes-disability-rights-law

News (used only where no primary source was found)
- TechCabal 14 Oct 2025: https://techcabal.com/2025/10/14/cbn-one-atm-per-5000-cards-pos-rules-tighten/
- TechCabal 16 Feb 2024: https://techcabal.com/2024/02/16/whats-next-for-nigerian-atms-as-investment-dries-up/
- TechCabal 28 Mar 2023: https://techcabal.com/2023/03/28/naira-redesign-a-torturous-vanity-project-comes-to-an-end/
- Intelpoint (ATMs per adult): https://intelpoint.co/insights/nigeria-has-fewer-atms-per-adult-than-at-any-point-since-2012/ ; (POS 2024): https://intelpoint.co/insights/nigeria-saw-an-increase-of-2-9-million-deployed-pos-in-2024-following-the-naira-redesign-in-2023/
- Nairametrics 14 Mar 2026: https://nairametrics.com/2026/03/14/cbn-mandates-one-atm-per-7500-payment-cards-by-2028/
- Nairametrics 28 Mar 2025 (Zenith): https://nairametrics.com/2025/03/28/zenith-bank-grows-pos-terminals-to-475524-and-issues-27-9-million-atm-cards-in-2024/
- Nairametrics 24 Sep 2025 (First Bank): https://nairametrics.com/2025/09/24/firstbank-set-to-launch-tailored-financial-services-for-blind-and-physically-challenged-customers/
- Nairametrics 25 Sep 2026 (40 million): https://nairametrics.com/2026/09/25/cbn-identifies-40-million-nigerians-with-disabilities-as-untapped-fintech-market/
- Nairametrics (CBN refunds 2013-2023): https://nairametrics.com/?p=525132
- BrandSpur 16 Mar 2026: https://brandspurng.com/2026/03/16/cbn-sets-new-atm-deployment-rules-mandates-one-atm-per-7500-cards-by-2028/ ; Q1 2026 ATM volumes: https://brandspurng.com/?p=199790
- BusinessDay (instant reversal): https://businessday.ng/news/article/cbn-orders-banks-to-reverse-failed-atm-transactions-immediately/
- BusinessDay 18 Nov 2022 via PressReader (Inlaks): https://www.pressreader.com/nigeria/business-day-nigeria/20221118/281715503610436
- ThisDay 26 Jan 2023: https://www.thisdaylive.com/2023/01/26/role-of-atms-pos-in-cashless-policy/
- Guardian (Inlaks fingerprint ATMs, 2015): https://guardian.ng/?p=840318
- ATM Marketplace (Diebold/Union Bank 2008): https://www.atmmarketplace.com/news/diebold-wins-contract-with-union-bank/
- Ripples Nigeria feature: https://www.ripplesnigeria.com/feature-marginalised-defrauded-how-nigerian-banks-shut-out-visually-impaired-customers-from-atms/
- Ripples / Legit.ng (Nnewi widow): https://ripplesnigeria.com/visually-impaired-widow-loses-over-n2m-as-suspected-fraudster-swaps-atm-card-in-anambra ; https://www.legit.ng/nigeria/1631611-visually-impaired-widow-falls-victim-atm-fraud-anambra
- Peoples Gazette (Yobe): https://gazettengr.com/yobe-police-arrest-atm-fraud-syndicate-recover-47-cards/
- Sahara Reporters 12 Jan 2024 (Kaduna): https://saharareporters.com/2024/01/12/court-jails-nigerian-10-years-fraudulently-swapping-48-atm-cards-bank-customers-kaduna
- Guardian (CITAB): https://guardian.ng/news/citab-accuses-banks-of-discrimination-against-blind-customers/
- Inclusive News (CITAB on CBN guidelines; not read): https://inclusivenews.com.ng/centre-slams-cbns-atm-accessibility-guidelines-as-inadequate-for-the-blind/
- Fintech Magazine Africa 7 Oct 2025: https://fintechmagazine.africa/2025/10/07/ubas-braille-banking-promise-remains-out-of-reach-for-many-blind-customers/
- Vanguard Jan 2026: https://www.vanguardngr.com/2026/01/how-failures-in-payment-pillars-infrastructure-lock-out-people-with-disabilities/
- AllAfrica Sep 2024: https://allafrica.com/stories/202409180078.html ; Oct 2024 (Reps): https://allafrica.com/stories/202410150658.html
- TheCable (Paycode, 13 banks): https://www.thecable.ng/13-banks-adopt-verves-paycode-cardless-transactions ; (NCPWD): https://www.thecable.ng/ncpwd-threatens-to-seal-organisations-not-accessible-to-pwds/
- Techpoint (Paycode): https://techpoint.africa/general/verve-paycode-cardless-atm-withdrawal/ ; (cash crunch, Feb 2023): https://techpoint.africa/2023/02/07/nigeria-is-not-ready-for-a-cashless-economy/
- DMarketForces (First Bank touchless ATM): https://dmarketforces.com/firstbank-launches-touchless-automated-teller-machine-in-nigeria/
- Finextra (NCR accessibility): https://www.finextra.com/newsarticle/7403/ncr-adds-accessibility-features-to-atms ; https://finextra.com/newsarticle/2502/ncr-commits-to-audio-enabled-atms-for-us-shipments
- Business Standard May 2014 (RBI): https://www.business-standard.com/article/finance/make-all-new-atms-talking-ones-from-july-rbi-to-banks-114052101373_1.html
- Bird & Bird 2025 (EAA): https://www.twobirds.com/en/insights/2025/european-accessibility-act-focus-on-financial-services
- Duane Morris (ADA): https://www.duanemorris.com/alerts/mandatory_ADA_standards_on_accessibility_ATMs_visually_impaired_now_in_effect_4437.html

Failed fetches (blocked by this session's network): cbn.gov.ng, placng.org, regalert.today, inclusivenews.com.ng, adry.up.ac.za. A later session with these hosts allowed should re-check the CBN 2010, 2025 and 2026 texts and the Act.
