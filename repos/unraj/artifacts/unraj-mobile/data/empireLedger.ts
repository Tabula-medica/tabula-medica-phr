// Empire Ledger (mobile) — country-by-country record of British colonial rule.
//
// EDITORIAL RULE: authenticated history only. Every entry is grounded in named
// historians, official reports, or primary records, cited in `sources` and shown
// in the UI. Contested figures are attributed or given as documented ranges.
// Mirror of the web dataset (artifacts/kohinoor-movement/src/data/empire-ledger.ts),
// condensed for the phone screen.

export interface LedgerEvent {
  year: string;
  text: string;
}

export interface CountryLedger {
  id: string;
  country: string;
  flag: string;
  region: string;
  ruleYears: string;
  colonyType: string;
  summary: string;
  events: LedgerEvent[];
  taken: string;
  sources: string[];
}

export const EMPIRE_LEDGER: CountryLedger[] = [
  {
    id: "india",
    country: "India",
    flag: "🇮🇳",
    region: "South Asia",
    ruleYears: "1757–1947",
    colonyType: "Company rule, then Crown Raj",
    summary:
      "Economist Utsa Patnaik calculates Britain drained roughly $45 trillion (£9.2 trillion) from India between 1765 and 1938. India's share of the world economy fell from about a quarter to a few percent under the Raj.",
    events: [
      { year: "1770", text: "Great Bengal Famine killed an estimated 10 million — a third of Bengal — as the Company kept collecting revenue." },
      { year: "1919", text: "At Jallianwala Bagh, troops fired on an unarmed crowd: British records admit 379 dead, Indian estimates exceed 1,000." },
      { year: "1943", text: "The Bengal Famine killed up to 3 million; scholars tie it to wartime policy, not crop shortfall alone." },
    ],
    taken: "Koh-i-Noor Diamond, Tipu Sultan's throne fittings, Amaravati Marbles — 20,000+ South Asian objects in the British Museum alone.",
    sources: [
      "Utsa Patnaik (Columbia UP / Tulika, 2018)",
      "Shashi Tharoor, 'Inglorious Empire' (2017)",
      "Amartya Sen, 'Poverty and Famines' (1981)",
    ],
  },
  {
    id: "bangladesh",
    country: "Bangladesh",
    flag: "🇧🇩",
    region: "South Asia",
    ruleYears: "1757–1947",
    colonyType: "Part of Bengal under Company, then Crown",
    summary:
      "Eastern Bengal bore the sharpest edge of colonial famine and de-industrialisation. Its world-famous Dhaka muslin collapsed as Britain protected Lancashire cloth.",
    events: [
      { year: "1770", text: "The Bengal Famine devastated the region as Company revenue collection was enforced." },
      { year: "1943", text: "Famine struck hardest in the east; grain was diverted and boats confiscated under the 'denial policy'." },
    ],
    taken: "Dhaka muslin industry destroyed by tariffs; Bengal manuscripts and textiles dispersed to UK collections.",
    sources: [
      "W. W. Hunter, 'The Annals of Rural Bengal' (1868)",
      "Amartya Sen, 'Poverty and Famines' (1981)",
    ],
  },
  {
    id: "pakistan",
    country: "Pakistan",
    flag: "🇵🇰",
    region: "South Asia",
    ruleYears: "1849–1947",
    colonyType: "Punjab & Sind annexed to British India",
    summary:
      "The 1947 Partition — drawn in five weeks by a barrister who had never been to India — split Punjab and Bengal and unleashed one of history's largest and bloodiest migrations.",
    events: [
      { year: "1849", text: "Britain annexed the Punjab; the Koh-i-Noor was surrendered to the Crown under the Treaty of Lahore." },
      { year: "1947", text: "The Radcliffe Line partitioned the subcontinent; up to 1–2 million died and ~14–15 million were displaced." },
    ],
    taken: "Koh-i-Noor Diamond (via Lahore, 1849); Gandhara and Indus Valley antiquities held in UK museums.",
    sources: [
      "Yasmin Khan, 'The Great Partition' (2007)",
      "Nisid Hajari, 'Midnight's Furies' (2015)",
    ],
  },
  {
    id: "ireland",
    country: "Ireland",
    flag: "🇮🇪",
    region: "Europe",
    ruleYears: "1801–1922",
    colonyType: "Kingdom, then part of the UK",
    summary:
      "Britain's oldest colony. Plantation, penal laws and absentee landlordism culminated in the Great Famine, when Ireland kept exporting food under guard while a million starved.",
    events: [
      { year: "1845–52", text: "The Great Famine killed about 1 million and forced 1–2 million to emigrate; food exports to Britain continued." },
      { year: "1920", text: "On 'Bloody Sunday', British forces fired into a crowd at Croke Park, Dublin, killing 14 civilians." },
    ],
    taken: "Land transferred to a Protestant Ascendancy under the plantations; population fell ~25% and never recovered.",
    sources: [
      "Cormac Ó Gráda, 'Black '47 and Beyond' (1999)",
      "Cecil Woodham-Smith, 'The Great Hunger' (1962)",
    ],
  },
  {
    id: "nigeria",
    country: "Nigeria",
    flag: "🇳🇬",
    region: "Africa",
    ruleYears: "1861–1960",
    colonyType: "Company rule, then Crown colony",
    summary:
      "Governed first for profit by the Royal Niger Company, Nigeria saw one of the empire's most notorious acts of cultural destruction in the 1897 sacking of Benin City.",
    events: [
      { year: "1897", text: "A British 'punitive expedition' burned Benin City and looted thousands of the Benin Bronzes." },
      { year: "1929", text: "The Aba Women's War: colonial forces killed dozens of women protesting taxation." },
    ],
    taken: "Benin Bronzes (thousands of pieces) held by the British Museum and institutions worldwide; return is ongoing and incomplete.",
    sources: [
      "Dan Hicks, 'The Brutish Museums' (2020)",
      "British Museum provenance records, Benin collection",
    ],
  },
  {
    id: "kenya",
    country: "Kenya",
    flag: "🇰🇪",
    region: "Africa",
    ruleYears: "1895–1963",
    colonyType: "Protectorate, then Crown colony",
    summary:
      "Fertile highlands were seized for white settlers. Britain's suppression of the Mau Mau uprising involved a documented system of detention camps and torture.",
    events: [
      { year: "1952–60", text: "During the Mau Mau Emergency, tens of thousands of Kikuyu were detained; historian Caroline Elkins documents systematic abuse." },
      { year: "2013", text: "The UK settled with 5,228 elderly Kenyans for £19.9m and expressed 'sincere regret' for torture (FCO statement to the Commons)." },
    ],
    taken: "'White Highlands' farmland expropriated from the Kikuyu and Maasai; detention files secretly retained in the UK 'Hanslope' archive.",
    sources: [
      "Caroline Elkins, 'Britain's Gulag' (2005)",
      "William Hague, FCO statement, Hansard, 6 June 2013",
    ],
  },
  {
    id: "south-africa",
    country: "South Africa",
    flag: "🇿🇦",
    region: "Africa",
    ruleYears: "1806–1910",
    colonyType: "Cape & Natal colonies; Boer republics annexed",
    summary:
      "Diamonds and gold drew Britain into wars of conquest. In the Second Boer War it pioneered the modern concentration camp.",
    events: [
      { year: "1900–02", text: "In Boer War camps, ~26,000 Boer women and children and at least 20,000 Black Africans died of disease and starvation." },
      { year: "1867–86", text: "Diamond and gold discoveries at Kimberley and the Witwatersrand drove land seizures and migrant-labour systems." },
    ],
    taken: "Diamond and gold wealth (De Beers, Rand mines); the Cullinan Diamond, now in the Crown Jewels and Sovereign's Sceptre.",
    sources: [
      "Emily Hobhouse, 'Report on the Concentration Camps' (1901)",
      "Thomas Pakenham, 'The Boer War' (1979)",
    ],
  },
  {
    id: "egypt",
    country: "Egypt",
    flag: "🇪🇬",
    region: "Middle East",
    ruleYears: "1882–1956",
    colonyType: "Occupation, then protectorate (1914)",
    summary:
      "Britain occupied Egypt to secure the Suez Canal and its route to India, ruling behind a nominal monarchy while its antiquities flowed to Europe.",
    events: [
      { year: "1801", text: "The Rosetta Stone was taken by the British Army and shipped to London, where it remains in the British Museum." },
      { year: "1906", text: "The Denshawai incident: villagers were hanged and flogged after a clash with British officers." },
    ],
    taken: "Rosetta Stone and Egyptian obelisks in the British Museum; 'Cleopatra's Needle' on the Thames Embankment.",
    sources: [
      "British Museum, Rosetta Stone acquisition records (1802)",
      "Afaf Lutfi al-Sayyid Marsot, 'A History of Egypt' (2007)",
    ],
  },
  {
    id: "ghana",
    country: "Ghana",
    flag: "🇬🇭",
    region: "Africa",
    ruleYears: "1821–1957",
    colonyType: "Gold Coast Crown colony; Ashanti conquered",
    summary:
      "The 'Gold Coast' was named for what Britain wanted from it. Anglo-Ashanti wars ended with the exile of the Asantehene and an attempt to seize the sacred Golden Stool.",
    events: [
      { year: "1874", text: "British forces sacked the Ashanti capital Kumasi and looted the royal regalia." },
      { year: "1900", text: "The War of the Golden Stool erupted after a governor demanded to sit on the sacred stool." },
    ],
    taken: "Ashanti gold regalia looted in 1874; some held by the British Museum and V&A, with loans back to Ghana only from 2024.",
    sources: [
      "Ivor Wilks, 'Asante in the Nineteenth Century' (1975)",
      "British Museum / V&A 2024 Asante regalia loan agreement",
    ],
  },
  {
    id: "zimbabwe",
    country: "Zimbabwe",
    flag: "🇿🇼",
    region: "Africa",
    ruleYears: "1890–1980",
    colonyType: "Company rule (BSAC), then self-governing colony",
    summary:
      "Cecil Rhodes's British South Africa Company conquered the land it renamed 'Rhodesia' after him, seizing cattle and territory; settler minority rule persisted until 1980.",
    events: [
      { year: "1893", text: "The BSAC destroyed the Ndebele kingdom and looted its cattle after the First Matabele War." },
      { year: "1896–97", text: "The First Chimurenga was suppressed; leaders including the medium Nehanda were executed." },
    ],
    taken: "Vast African land alienated to settlers; the soapstone 'Zimbabwe Birds' removed from Great Zimbabwe.",
    sources: [
      "Terence Ranger, 'Revolt in Southern Rhodesia 1896–7' (1967)",
      "BSAC records, National Archives of Zimbabwe",
    ],
  },
  {
    id: "jamaica",
    country: "Jamaica",
    flag: "🇯🇲",
    region: "Caribbean & Americas",
    ruleYears: "1655–1962",
    colonyType: "Slave-plantation colony, then Crown colony",
    summary:
      "For nearly two centuries a sugar colony built on enslaved African labour. When freedpeople demanded justice after emancipation, the response was massacre.",
    events: [
      { year: "1831–32", text: "The Baptist War, a large enslaved-people's uprising, was suppressed with hundreds of executions — but hastened abolition." },
      { year: "1865", text: "The Morant Bay Rebellion was crushed by Governor Eyre: about 439 people killed and hundreds flogged." },
    ],
    taken: "Generations of unpaid enslaved labour; at abolition Britain compensated slave-owners, not the enslaved.",
    sources: [
      "UCL 'Legacies of British Slavery' database",
      "Gad Heuman, ''The Killing Time'' (1994)",
    ],
  },
  {
    id: "guyana",
    country: "Guyana",
    flag: "🇬🇾",
    region: "Caribbean & Americas",
    ruleYears: "1814–1966",
    colonyType: "British Guiana Crown colony",
    summary:
      "After abolition Britain replaced enslaved labour with indentured workers shipped from India — a system critics called 'a new system of slavery'.",
    events: [
      { year: "1823", text: "The Demerara slave rebellion was brutally suppressed; missionary John Smith died in custody, fuelling abolition." },
      { year: "1838–1917", text: "Around 240,000 indentured Indians were transported to British Guiana under coercive contracts." },
    ],
    taken: "Sugar-plantation profits; enslaved and later indentured labour extracted under conditions documented in Parliamentary papers.",
    sources: [
      "Hugh Tinker, 'A New System of Slavery' (1974)",
      "British Parliamentary Papers on indenture",
    ],
  },
  {
    id: "australia",
    country: "Australia",
    flag: "🇦🇺",
    region: "Oceania",
    ruleYears: "1788–1901",
    colonyType: "Penal, then settler colonies",
    summary:
      "Britain claimed the continent as 'terra nullius' — land belonging to no one — despite tens of thousands of years of Aboriginal habitation.",
    events: [
      { year: "1788–1930s", text: "Frontier wars and massacres killed tens of thousands of Aboriginal people (Univ. of Newcastle massacre map)." },
      { year: "1910–1970", text: "The 'Stolen Generations': policy forcibly removed Aboriginal children, detailed in the 1997 'Bringing Them Home' report." },
    ],
    taken: "A continent taken under terra nullius (overturned only in 1992's Mabo decision); Aboriginal ancestral remains held in UK institutions.",
    sources: [
      "'Bringing Them Home' (Australian Human Rights Commission, 1997)",
      "Henry Reynolds, 'The Other Side of the Frontier' (1981)",
    ],
  },
  {
    id: "myanmar",
    country: "Myanmar (Burma)",
    flag: "🇲🇲",
    region: "East Asia",
    ruleYears: "1824–1948",
    colonyType: "Annexed to British India, then separate colony",
    summary:
      "Three Anglo-Burmese wars ended in annexation, the exile of the last king, and the looting of the royal palace at Mandalay.",
    events: [
      { year: "1885", text: "Britain deposed King Thibaw, exiled the royal family, and looted the Mandalay treasury — including the Nga Mauk ruby, never recovered." },
      { year: "1930–32", text: "The Saya San peasant rebellion against colonial taxation was suppressed with thousands killed or jailed." },
    ],
    taken: "Mandalay royal regalia and jewels; teak, oil and rice revenues. Some royal artefacts remain in UK collections.",
    sources: [
      "Thant Myint-U, 'The River of Lost Footsteps' (2006)",
      "Records of the Third Anglo-Burmese War (1885), British Library",
    ],
  },
  {
    id: "sri-lanka",
    country: "Sri Lanka (Ceylon)",
    flag: "🇱🇰",
    region: "South Asia",
    ruleYears: "1796–1948",
    colonyType: "Crown colony; Kandy annexed 1815",
    summary:
      "Britain took the last independent Sinhalese kingdom of Kandy in 1815 and reshaped the island into a plantation economy of coffee and tea.",
    events: [
      { year: "1815", text: "The Kandyan Convention ended the 2,300-year-old Sinhalese monarchy; the throne and regalia were removed to Britain." },
      { year: "1818 & 1848", text: "Rebellions against British rule were suppressed with executions and collective punishment." },
    ],
    taken: "The Kandyan throne and royal regalia (some later returned); forests cleared for British-owned plantations.",
    sources: [
      "K. M. de Silva, 'A History of Sri Lanka' (1981)",
      "Kandyan Convention (1815) text, National Archives",
    ],
  },
  {
    id: "malaysia",
    country: "Malaysia (Malaya)",
    flag: "🇲🇾",
    region: "East Asia",
    ruleYears: "1786–1957",
    colonyType: "Straits Settlements, protected states",
    summary:
      "Malaya's tin and rubber made it one of the empire's most profitable possessions. Post-war counter-insurgency included forced resettlement and a documented massacre.",
    events: [
      { year: "1948", text: "At Batang Kali, British troops shot dead 24 unarmed villagers; the UK has never held a full public inquiry." },
      { year: "1948–60", text: "During the Malayan Emergency, ~500,000 mostly Chinese Malayans were forcibly resettled into guarded 'New Villages'." },
    ],
    taken: "Tin and rubber revenues that underwrote post-war British finances.",
    sources: [
      "Christopher Hale, 'Massacre in Malaya' (2013)",
      "UK Supreme Court, Keyu v FCO (2015)",
    ],
  },
  {
    id: "hong-kong",
    country: "Hong Kong / China",
    flag: "🇭🇰",
    region: "East Asia",
    ruleYears: "1841–1997",
    colonyType: "Ceded after the Opium Wars",
    summary:
      "Britain fought two wars to force China to keep buying opium, then seized Hong Kong. The 1860 burning of the Old Summer Palace was one of history's great acts of cultural vandalism.",
    events: [
      { year: "1842", text: "The Treaty of Nanking ceded Hong Kong Island to Britain and imposed indemnities on China." },
      { year: "1860", text: "British and French troops looted and burned the Yuanmingyuan (Old Summer Palace); its treasures were scattered west." },
    ],
    taken: "Yuanmingyuan bronzes, jade, silk and porcelain; imperial seals and manuscripts, many still in British and French museums.",
    sources: [
      "Julia Lovell, 'The Opium War' (2011)",
      "Treaty of Nanking (1842)",
    ],
  },
  {
    id: "iraq",
    country: "Iraq",
    flag: "🇮🇶",
    region: "Middle East",
    ruleYears: "1920–1932 (mandate)",
    colonyType: "League of Nations mandate",
    summary:
      "Britain assembled modern Iraq from three Ottoman provinces to control its oil, then crushed the revolt against the mandate from the air.",
    events: [
      { year: "1920", text: "The Iraqi revolt was suppressed; the RAF bombed villages, a tactic openly discussed by officials including Churchill." },
      { year: "1927", text: "Oil at Kirkuk cemented Western control of Iraqi petroleum through the Iraq Petroleum Company." },
    ],
    taken: "Control of Iraqi oil concessions; Mesopotamian antiquities exported, many now in the British Museum.",
    sources: [
      "Toby Dodge, 'Inventing Iraq' (2003)",
      "RAF operational records, 1920–24, National Archives",
    ],
  },
  {
    id: "palestine",
    country: "Palestine",
    flag: "🇵🇸",
    region: "Middle East",
    ruleYears: "1920–1948",
    colonyType: "League of Nations mandate",
    summary:
      "Under the 1917 Balfour Declaration, Britain — ruling Palestine under a League of Nations mandate — promised support for a 'national home for the Jewish people' in a land whose existing population it governed. The mandate ended in 1948; its consequences remain contested.",
    events: [
      { year: "1917", text: "Foreign Secretary Arthur Balfour issued the Balfour Declaration in a letter to Lord Rothschild." },
      { year: "1936–39", text: "The Arab Revolt against British rule and mass immigration was suppressed by British forces." },
    ],
    taken: "Administrative control of Palestine under the mandate; the wider consequences remain among the most contested legacies of empire.",
    sources: [
      "Balfour Declaration (1917), full text",
      "League of Nations Mandate for Palestine (1922)",
    ],
  },
  {
    id: "sudan",
    country: "Sudan",
    flag: "🇸🇩",
    region: "Africa",
    ruleYears: "1899–1956",
    colonyType: "Anglo-Egyptian Condominium",
    summary:
      "Britain reconquered Sudan after the Mahdist state in a campaign that culminated in the one-sided Battle of Omdurman, then governed north and south separately.",
    events: [
      { year: "1898", text: "At Omdurman, Anglo-Egyptian forces with machine guns killed ~10,000 Mahdists for a few hundred of their own — witnessed by a young Winston Churchill." },
      { year: "1899", text: "The Mahdi's tomb was demolished and his remains disinterred on Kitchener's orders." },
    ],
    taken: "Mahdist regalia and manuscripts taken as war trophies; 'separate development' of the south left a lasting fault line.",
    sources: [
      "Winston Churchill, 'The River War' (1899)",
      "P. M. Holt, 'A History of the Sudan' (1961)",
    ],
  },
  {
    id: "cyprus",
    country: "Cyprus",
    flag: "🇨🇾",
    region: "Europe",
    ruleYears: "1878–1960",
    colonyType: "Administered 1878, Crown colony 1925",
    summary:
      "Britain took Cyprus from the Ottomans to guard the route to Suez. The 1950s campaign for union with Greece met detention and interrogation practices later challenged as torture.",
    events: [
      { year: "1955–59", text: "During the EOKA insurgency, Britain detained hundreds without trial; torture allegations reached the European Commission of Human Rights." },
      { year: "1956", text: "Hangings of EOKA prisoners intensified the conflict and international scrutiny." },
    ],
    taken: "Strategic control of the island; two 'Sovereign Base Areas' remain British territory today.",
    sources: [
      "David French, 'Fighting EOKA' (2015)",
      "European Commission of Human Rights, Cyprus cases (1956–59)",
    ],
  },
  {
    id: "uganda",
    country: "Uganda",
    flag: "🇺🇬",
    region: "Africa",
    ruleYears: "1894–1962",
    colonyType: "Protectorate",
    summary:
      "Uganda was reorganised around the kingdom of Buganda through 'indirect rule'. The Uganda Railway was built with indentured labour from British India, thousands of whom died.",
    events: [
      { year: "1896–1901", text: "The Uganda Railway was built largely by ~32,000 indentured Indian workers; thousands died from disease, accidents and lion attacks near Tsavo." },
      { year: "1900", text: "The Buganda Agreement entrenched colonial land control while co-opting local elites." },
    ],
    taken: "Land and labour reorganised for cotton and coffee export; the kingdom's autonomy subordinated to colonial administration.",
    sources: [
      "Uganda Railway Committee records (1896–1903)",
      "Mahmood Mamdani, 'Politics and Class Formation in Uganda' (1976)",
    ],
  },
  {
    id: "canada",
    country: "Canada",
    flag: "🇨🇦",
    region: "Caribbean & Americas",
    ruleYears: "1763–1931",
    colonyType: "Settler colonies, then Dominion (1867)",
    summary:
      "British settlement and the Hudson's Bay Company's fur monopoly dispossessed Indigenous nations. The residential-school system sought to erase Indigenous cultures.",
    events: [
      { year: "1670–1869", text: "The Hudson's Bay Company held a monopoly over 'Rupert's Land', covering much of modern Canada, over its Indigenous inhabitants." },
      { year: "1880s–1996", text: "Residential schools removed Indigenous children; Canada's Truth and Reconciliation Commission (2015) termed it 'cultural genocide'." },
    ],
    taken: "Indigenous land ceded under duress or unratified treaties; ceremonial objects held in UK and Canadian museums.",
    sources: [
      "Truth and Reconciliation Commission of Canada (2015)",
      "Hudson's Bay Company Charter (1670)",
    ],
  },
  {
    id: "atlantic-slave-trade",
    country: "The Atlantic Slave Trade",
    flag: "⛓️",
    region: "Cross-cutting",
    ruleYears: "1562–1833",
    colonyType: "Empire-wide system of enslavement",
    summary:
      "British ships trafficked more enslaved Africans than almost any other nation. When slavery was abolished, it was the slave-owners — not the enslaved — whom the British state chose to compensate.",
    events: [
      { year: "1640s–1807", text: "British and colonial ships carried an estimated 3.1–3.4 million enslaved Africans across the Atlantic (Trans-Atlantic Slave Trade Database)." },
      { year: "1833", text: "The Slavery Abolition Act granted £20 million — ~40% of the Treasury's annual budget — to compensate ~47,000 slave-owners." },
      { year: "2015", text: "HM Treasury stated the loan raised to pay that compensation was only finally paid off by taxpayers in 2015 (caveats noted by Full Fact)." },
    ],
    taken: "Generations of stolen African lives and labour; no reparation was ever paid to the enslaved or their descendants.",
    sources: [
      "Trans-Atlantic Slave Trade Database (slavevoyages.org)",
      "UCL 'Legacies of British Slavery' project",
      "HM Treasury (2018) & Full Fact on the 1833 compensation loan",
    ],
  },
];

export const LEDGER_REGIONS = [
  "All",
  "South Asia",
  "Africa",
  "Middle East",
  "East Asia",
  "Caribbean & Americas",
  "Oceania",
  "Europe",
  "Cross-cutting",
];
