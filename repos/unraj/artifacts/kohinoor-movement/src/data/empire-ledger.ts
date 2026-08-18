// Empire Ledger — a country-by-country record of British colonial rule.
//
// EDITORIAL RULE: authenticated history only. Every entry below is grounded in
// named historians, official government reports, primary records, or public
// databases — cited in the `sources` field and rendered visibly in the UI.
// Contested figures are attributed to their author or given as documented ranges
// rather than asserted as settled fact. If a claim cannot be sourced, it does
// not belong here.
//
// This dataset is intentionally kept in English as a factual/citation record.
// The surrounding UI chrome (headings, labels) is translated via i18next; the
// ledger entries themselves are primary-source history and are not machine-
// translated, to avoid distorting quoted figures and names.

export interface LedgerEvent {
  year: string;
  text: string;
}

export interface LedgerEntry {
  id: string;
  country: string;
  flag: string;
  region: "South Asia" | "Africa" | "Middle East" | "East Asia" | "Caribbean & Americas" | "Oceania" | "Europe" | "Cross-cutting";
  ruleYears: string;
  colonyType: string;
  summary: string;
  events: LedgerEvent[];
  taken: string;
  sources: string[];
}

export const EMPIRE_LEDGER: LedgerEntry[] = [
  {
    id: "india",
    country: "India",
    flag: "🇮🇳",
    region: "South Asia",
    ruleYears: "1757–1947",
    colonyType: "East India Company rule, then Crown Raj (1858)",
    summary:
      "Two centuries of extraction turned one of the world's richest economies into one of its poorest. Economist Utsa Patnaik calculates that Britain drained roughly $45 trillion (£9.2 trillion) from India between 1765 and 1938, measured as India's export-surplus earnings compounded at a conservative rate. India's share of the world economy fell from about a quarter to a few percent over the Raj.",
    events: [
      { year: "1770", text: "Great Bengal Famine under Company rule killed an estimated 10 million people — roughly a third of Bengal — while the Company continued collecting land revenue." },
      { year: "1919", text: "At Jallianwala Bagh, Amritsar, troops under Gen. Dyer fired on an unarmed crowd: British records admit 379 dead, Indian estimates exceed 1,000." },
      { year: "1943", text: "The Bengal Famine killed up to 3 million; Amartya Sen and later scholars tie the death toll to wartime policy, grain exports, and administrative failure, not crop shortfall alone." },
    ],
    taken: "Koh-i-Noor Diamond · Tipu Sultan's throne fittings · Amaravati Marbles · Sultanganj Buddha · 20,000+ South Asian objects in the British Museum alone.",
    sources: [
      "Utsa Patnaik, in 'Agrarian and Other Histories' (Columbia UP / Tulika, 2018)",
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
    colonyType: "Part of Bengal Presidency under Company, then Crown",
    summary:
      "Eastern Bengal — today's Bangladesh — bore the sharpest edge of colonial famine and de-industrialisation. Its world-renowned muslin weaving collapsed as Britain protected Lancashire cloth, and its people twice suffered catastrophic famine under British administration.",
    events: [
      { year: "1770", text: "The Bengal Famine devastated the region; contemporary Company official Warren Hastings acknowledged mass death even as revenue collection was enforced." },
      { year: "1943", text: "The Bengal Famine again struck hardest in the east; grain was diverted for the war effort and boats confiscated under the 'denial policy'." },
      { year: "1947", text: "Partition split Bengal; the eastern half became East Pakistan, triggering mass displacement." },
    ],
    taken: "Dhaka muslin industry destroyed by protectionist tariffs; Bengal manuscripts and textiles dispersed to UK collections.",
    sources: [
      "W. W. Hunter, 'The Annals of Rural Bengal' (1868)",
      "Amartya Sen, 'Poverty and Famines' (1981)",
      "Cormac Ó Gráda, 'Famine: A Short History' (2009)",
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
      "The 1947 Partition of British India — drawn in five weeks by a barrister, Cyril Radcliffe, who had never been to India — split Punjab and Bengal and unleashed one of the largest and bloodiest migrations in human history.",
    events: [
      { year: "1849", text: "Britain annexed the Punjab after the Anglo-Sikh Wars; the Koh-i-Noor was surrendered to the Crown under the Treaty of Lahore." },
      { year: "1947", text: "The Radcliffe Line partitioned the subcontinent; up to 1–2 million people died in the ensuing violence and around 14–15 million were displaced." },
    ],
    taken: "Koh-i-Noor Diamond (via Lahore, 1849); Gandhara and Indus Valley antiquities held in UK museums.",
    sources: [
      "Nisid Hajari, 'Midnight's Furies' (2015)",
      "Yasmin Khan, 'The Great Partition' (2007)",
      "Treaty of Lahore (1846) & annexation records, British Library",
    ],
  },
  {
    id: "ireland",
    country: "Ireland",
    flag: "🇮🇪",
    region: "Europe",
    ruleYears: "1801–1922 (conquest from 1500s)",
    colonyType: "Kingdom, then part of the United Kingdom",
    summary:
      "Britain's oldest colony. Plantation, penal laws, and absentee landlordism culminated in the Great Famine, when Ireland continued to export food under armed guard while a million of its people starved.",
    events: [
      { year: "1845–52", text: "The Great Famine killed about 1 million and forced another 1–2 million to emigrate; food exports to Britain continued throughout." },
      { year: "1916", text: "The Easter Rising was suppressed and its leaders executed, hardening the drive for independence." },
      { year: "1920", text: "On 'Bloody Sunday', British forces fired into a crowd at Croke Park, Dublin, killing 14 civilians." },
    ],
    taken: "Land transferred to a Protestant Ascendancy under the plantations; population fell roughly 25% and has never recovered to pre-Famine levels.",
    sources: [
      "Cormac Ó Gráda, 'Black '47 and Beyond' (1999)",
      "Cecil Woodham-Smith, 'The Great Hunger' (1962)",
      "Irish census records, 1841–1851",
    ],
  },
  {
    id: "nigeria",
    country: "Nigeria",
    flag: "🇳🇬",
    region: "Africa",
    ruleYears: "1861–1960",
    colonyType: "Chartered-company rule, then Crown colony & protectorates",
    summary:
      "Governed first for profit by the Royal Niger Company and then as a Crown colony, Nigeria saw one of the empire's most notorious acts of cultural destruction in the 1897 sacking of Benin City.",
    events: [
      { year: "1897", text: "A British 'punitive expedition' burned Benin City and looted thousands of brass and ivory works — the Benin Bronzes — now scattered across Western museums." },
      { year: "1914", text: "Britain amalgamated northern and southern protectorates into a single Nigeria for administrative convenience, ignoring existing nations." },
      { year: "1929", text: "The Aba Women's War: colonial authorities killed dozens of women protesting taxation." },
    ],
    taken: "Benin Bronzes (thousands of pieces) held by the British Museum and institutions worldwide; return is ongoing and incomplete.",
    sources: [
      "Dan Hicks, 'The Brutish Museums' (2020)",
      "British Museum provenance records, Benin collection",
      "Toyin Falola & Matthew Heaton, 'A History of Nigeria' (2008)",
    ],
  },
  {
    id: "kenya",
    country: "Kenya",
    flag: "🇰🇪",
    region: "Africa",
    ruleYears: "1895–1963",
    colonyType: "East Africa Protectorate, then Crown colony",
    summary:
      "Fertile highlands were seized for white settlers while Africans were confined to reserves and pass laws. Britain's suppression of the Mau Mau uprising in the 1950s involved a documented system of detention camps and torture.",
    events: [
      { year: "1952–60", text: "During the Mau Mau Emergency, tens of thousands of Kikuyu were detained; historian Caroline Elkins documents a vast camp system and systematic abuse." },
      { year: "1959", text: "At Hola Camp, 11 detainees were beaten to death by guards — a scandal that reached Parliament." },
      { year: "2013", text: "The UK government settled with 5,228 elderly Kenyan claimants for £19.9 million and expressed 'sincere regret' for torture (FCO statement to the Commons)." },
    ],
    taken: "'White Highlands' farmland expropriated from the Kikuyu, Maasai and others; colonial-era detention files were secretly retained in the UK 'Hanslope' archive.",
    sources: [
      "Caroline Elkins, 'Britain's Gulag / Imperial Reckoning' (2005)",
      "William Hague, FCO statement, Hansard, 6 June 2013",
      "David Anderson, 'Histories of the Hanged' (2005)",
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
      "The discovery of diamonds and gold drew Britain into wars of conquest. During the Second Boer War, Britain pioneered the modern concentration camp, and its post-war settlement laid administrative foundations later hardened into apartheid.",
    events: [
      { year: "1900–02", text: "In concentration camps during the Boer War, roughly 26,000 Boer women and children and at least 20,000 Black Africans died of disease and starvation." },
      { year: "1867–86", text: "Diamond and gold discoveries at Kimberley and the Witwatersrand drove land seizures and migrant-labour systems." },
    ],
    taken: "Diamond and gold wealth (De Beers, Rand mines); the Cullinan Diamond, cut into stones set in the Crown Jewels and Sovereign's Sceptre.",
    sources: [
      "Emily Hobhouse, 'Report on the Concentration Camps' (1901)",
      "S. B. Spies, 'Methods of Barbarism?' (1977)",
      "Thomas Pakenham, 'The Boer War' (1979)",
    ],
  },
  {
    id: "egypt",
    country: "Egypt",
    flag: "🇪🇬",
    region: "Middle East",
    ruleYears: "1882–1956",
    colonyType: "Military occupation, then protectorate (1914)",
    summary:
      "Britain occupied Egypt to secure the Suez Canal and its route to India, ruling behind a nominal monarchy. Egyptian antiquities had already been flowing to Europe for decades, the most famous seized at the turn of the 19th century.",
    events: [
      { year: "1801", text: "The Rosetta Stone was taken from French forces by the British Army and shipped to London, where it remains in the British Museum." },
      { year: "1906", text: "The Denshawai incident: villagers were hanged and flogged after a clash with British officers, galvanising Egyptian nationalism." },
      { year: "1956", text: "The Anglo-French invasion of Suez collapsed under international pressure, marking the end of British dominance." },
    ],
    taken: "Rosetta Stone and Egyptian obelisks & sculpture in the British Museum; 'Cleopatra's Needle' re-erected on the Thames Embankment.",
    sources: [
      "British Museum, Rosetta Stone acquisition records (1802)",
      "Afaf Lutfi al-Sayyid Marsot, 'A History of Egypt' (2007)",
      "Robert Tignor, 'Modernization and British Colonial Rule in Egypt' (1966)",
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
      "The 'Gold Coast' was named for what Britain wanted from it. A series of Anglo-Ashanti wars ended with the exile of the Asantehene and an attempt to seize the sacred Golden Stool, the soul of the Ashanti nation.",
    events: [
      { year: "1874", text: "British forces sacked the Ashanti capital Kumasi and looted the royal regalia." },
      { year: "1896", text: "Asantehene Prempeh I was deposed and exiled to the Seychelles." },
      { year: "1900", text: "The War of the Golden Stool erupted after Governor Hodgson demanded to sit on the sacred stool; the Ashanti fought to protect it." },
    ],
    taken: "Ashanti gold regalia and 'Asante Gold' looted in 1874; some items held by the British Museum and V&A, with loans back to Ghana negotiated only in 2024.",
    sources: [
      "Ivor Wilks, 'Asante in the Nineteenth Century' (1975)",
      "A. Adu Boahen, 'African Perspectives on Colonialism' (1987)",
      "British Museum / V&A 2024 Asante regalia loan agreement",
    ],
  },
  {
    id: "zimbabwe",
    country: "Zimbabwe",
    flag: "🇿🇼",
    region: "Africa",
    ruleYears: "1890–1980",
    colonyType: "Chartered-company rule (BSAC), then self-governing colony",
    summary:
      "Cecil Rhodes's British South Africa Company conquered the land it renamed 'Rhodesia' after him, seizing cattle and territory. African resistance in the First Chimurenga was crushed, and settler minority rule persisted until 1980.",
    events: [
      { year: "1893", text: "The BSAC destroyed the Ndebele kingdom and looted its cattle after the First Matabele War." },
      { year: "1896–97", text: "The First Chimurenga (Shona and Ndebele uprising) was suppressed; leaders including the spirit medium Nehanda were executed." },
    ],
    taken: "Vast tracts of African land alienated to settlers; the soapstone 'Zimbabwe Birds' from Great Zimbabwe were removed, most later returned but one long held in South Africa.",
    sources: [
      "Terence Ranger, 'Revolt in Southern Rhodesia 1896–7' (1967)",
      "BSAC land and cattle records, National Archives of Zimbabwe",
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
      "For nearly two centuries Jamaica was a sugar colony built on enslaved African labour, generating enormous wealth for British planters and merchants. When freedpeople demanded justice after emancipation, the response was massacre.",
    events: [
      { year: "1831–32", text: "The Baptist War, a large enslaved-people's uprising, was suppressed with hundreds of executions — but hastened abolition." },
      { year: "1865", text: "The Morant Bay Rebellion was crushed by Governor Eyre: about 439 people were killed and hundreds flogged and homes burned." },
    ],
    taken: "Generations of unpaid enslaved labour; upon abolition Britain compensated slave-owners, not the enslaved.",
    sources: [
      "UCL 'Legacies of British Slavery' database",
      "Gad Heuman, ''The Killing Time': The Morant Bay Rebellion' (1994)",
      "Colonial Office records on the Eyre controversy (1866)",
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
      "After slavery was abolished, Britain replaced enslaved labour on its sugar estates with indentured workers shipped from India — a system critics called 'a new system of slavery' that reshaped the Caribbean's population.",
    events: [
      { year: "1823", text: "The Demerara slave rebellion was brutally suppressed; the missionary John Smith died in custody, fuelling the abolition movement in Britain." },
      { year: "1838–1917", text: "Around 240,000 indentured Indians were transported to British Guiana under contracts widely documented as coercive." },
    ],
    taken: "Sugar-plantation profits; enslaved and later indentured labour extracted under conditions documented in Parliamentary papers.",
    sources: [
      "Hugh Tinker, 'A New System of Slavery' (1974)",
      "Emilia Viotti da Costa, 'Crowns of Glory, Tears of Blood' (1994)",
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
      "Britain claimed the continent as 'terra nullius' — land belonging to no one — despite tens of thousands of years of Aboriginal habitation. Colonisation brought frontier massacres and, later, the forced removal of Indigenous children.",
    events: [
      { year: "1788–1930s", text: "Frontier wars and massacres killed tens of thousands of Aboriginal people; the University of Newcastle's massacre map documents hundreds of recorded sites." },
      { year: "1910–1970", text: "The 'Stolen Generations': government policy forcibly removed Aboriginal children from their families, detailed in the 1997 'Bringing Them Home' report." },
    ],
    taken: "A continent taken under the legal fiction of terra nullius (overturned only in 1992's Mabo decision); Aboriginal ancestral remains and sacred objects held in UK institutions.",
    sources: [
      "'Bringing Them Home' (Australian Human Rights Commission, 1997)",
      "Henry Reynolds, 'The Other Side of the Frontier' (1981)",
      "University of Newcastle, Colonial Frontier Massacres map",
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
      "Three Anglo-Burmese wars ended in the annexation of the kingdom, the exile of its last king, and the looting of the royal palace at Mandalay. Burma's teak, oil, and rice were extracted for imperial profit.",
    events: [
      { year: "1885", text: "Britain deposed King Thibaw, exiled the royal family to India, and looted the Mandalay palace treasury — including the Nga Mauk ruby, never recovered." },
      { year: "1930–32", text: "The Saya San peasant rebellion against colonial taxation was suppressed with thousands killed or imprisoned." },
    ],
    taken: "Mandalay royal regalia and jewels; teak, oil and rice revenues. Some Burmese royal artefacts remain in UK collections.",
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
    colonyType: "Crown colony; Kandyan kingdom annexed 1815",
    summary:
      "Britain absorbed the coastal areas from the Dutch and then, in 1815, took the last independent Sinhalese kingdom of Kandy. The island was reshaped into a plantation economy of coffee and then tea, with Tamil labourers brought from India.",
    events: [
      { year: "1815", text: "The Kandyan Convention ended the 2,300-year-old Sinhalese monarchy; the sacred throne and regalia were removed to Britain." },
      { year: "1818 & 1848", text: "Rebellions against British rule were suppressed with executions and collective punishment." },
    ],
    taken: "The Kandyan throne and royal regalia (some later returned); the island's forests cleared for British-owned plantations.",
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
      "Malaya's tin and rubber made it one of the empire's most profitable possessions. Britain's counter-insurgency during the post-war 'Emergency' included forced resettlement of half a million people and a documented massacre.",
    events: [
      { year: "1948", text: "At Batang Kali, British troops shot dead 24 unarmed villagers; the UK has never held a full public inquiry despite decades of campaigning." },
      { year: "1948–60", text: "During the Malayan Emergency, around 500,000 mostly Chinese Malayans were forcibly resettled into guarded 'New Villages'." },
    ],
    taken: "Tin and rubber revenues that underwrote post-war British finances; the profits of the Emergency-era plantation economy.",
    sources: [
      "Christopher Hale, 'Massacre in Malaya' (2013)",
      "UK Supreme Court judgment on Batang Kali, Keyu v FCO (2015)",
    ],
  },
  {
    id: "hong-kong",
    country: "Hong Kong / China",
    flag: "🇭🇰",
    region: "East Asia",
    ruleYears: "1841–1997",
    colonyType: "Ceded territory after the Opium Wars",
    summary:
      "Britain fought two wars to force China to keep buying opium, then seized Hong Kong as a trophy. The 1860 burning of Beijing's Old Summer Palace was one of the greatest acts of cultural vandalism in history.",
    events: [
      { year: "1842", text: "The Treaty of Nanking, after the First Opium War, ceded Hong Kong Island to Britain and imposed indemnities on China." },
      { year: "1860", text: "British and French troops looted and burned the Yuanmingyuan (Old Summer Palace); its bronzes and treasures were scattered to Western collections." },
    ],
    taken: "Yuanmingyuan bronzes, jade, silk and porcelain; imperial seals and manuscripts, many still in British and French museums.",
    sources: [
      "Julia Lovell, 'The Opium War' (2011)",
      "Treaty of Nanking (1842), full text",
      "James Hevia, 'English Lessons' (2003)",
    ],
  },
  {
    id: "iraq",
    country: "Iraq",
    flag: "🇮🇶",
    region: "Middle East",
    ruleYears: "1920–1932 (mandate); influence to 1958",
    colonyType: "League of Nations mandate",
    summary:
      "Britain assembled modern Iraq from three Ottoman provinces to control its oil and the route to India, then crushed the revolt against the mandate from the air — an early use of aerial bombardment against civilians.",
    events: [
      { year: "1920", text: "The Iraqi revolt against British rule was suppressed; the RAF bombed villages, a tactic openly discussed by officials including Churchill." },
      { year: "1927–", text: "The discovery of oil at Kirkuk cemented British and Western control of Iraqi petroleum through the Iraq Petroleum Company." },
    ],
    taken: "Control of Iraqi oil concessions; Mesopotamian antiquities excavated and exported, many now in the British Museum.",
    sources: [
      "Toby Dodge, 'Inventing Iraq' (2003)",
      "RAF operational records, 1920–1924, National Archives",
      "Priya Satia, 'Spies in Arabia' (2008)",
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
      "Under the 1917 Balfour Declaration, Britain — while ruling Palestine under a League of Nations mandate — promised to support a 'national home for the Jewish people' in a land whose existing population it governed. The mandate ended in 1948 with Britain's withdrawal, leaving competing claims and unresolved conflict.",
    events: [
      { year: "1917", text: "Foreign Secretary Arthur Balfour issued the Balfour Declaration in a letter to Lord Rothschild." },
      { year: "1936–39", text: "The Arab Revolt against British rule and mass Jewish immigration was suppressed by British forces." },
      { year: "1947–48", text: "Britain referred the question to the UN and withdrew, ending the mandate." },
    ],
    taken: "Administrative control of Palestine under the mandate; the wider consequences remain among the most contested legacies of empire.",
    sources: [
      "Balfour Declaration (1917), full text",
      "League of Nations Mandate for Palestine (1922)",
      "Rashid Khalidi, 'The Iron Cage' (2006)",
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
      "Britain reconquered Sudan after the Mahdist state, in a campaign that culminated in the one-sided Battle of Omdurman. It then ruled through a condominium with Egypt, governing north and south separately in ways that seeded later conflict.",
    events: [
      { year: "1898", text: "At Omdurman, Anglo-Egyptian forces with machine guns killed around 10,000 Mahdist fighters for a few hundred of their own — described first-hand by a young Winston Churchill." },
      { year: "1899", text: "The Mahdi's tomb was demolished and his remains disinterred on Kitchener's orders." },
    ],
    taken: "Mahdist regalia and manuscripts taken as war trophies; the 'separate development' of the south left a lasting fault line.",
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
    colonyType: "Administered from 1878, annexed 1914, Crown colony 1925",
    summary:
      "Britain took Cyprus from the Ottomans to guard the route to Suez. When Greek Cypriots campaigned for union with Greece in the 1950s, Britain declared a state of emergency marked by detention and interrogation practices later challenged as torture.",
    events: [
      { year: "1955–59", text: "During the EOKA insurgency, Britain detained hundreds without trial; allegations of torture led to cases at the European Commission of Human Rights." },
      { year: "1956", text: "Hangings of EOKA prisoners intensified the conflict and international scrutiny." },
    ],
    taken: "Strategic control of the island; two 'Sovereign Base Areas' remain British territory to this day.",
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
      "Uganda was declared a protectorate and reorganised around the kingdom of Buganda through 'indirect rule'. The Uganda Railway — built to link the interior to the coast — was constructed with indentured labour brought from British India, thousands of whom died.",
    events: [
      { year: "1896–1901", text: "The Uganda Railway was built largely by ~32,000 indentured Indian workers; thousands died from disease, accidents and — near Tsavo — lion attacks." },
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
    ruleYears: "1763–1931 (settlement from 1600s)",
    colonyType: "Settler colonies, then Dominion (1867)",
    summary:
      "British settlement and the Hudson's Bay Company's fur monopoly dispossessed Indigenous nations of their land through treaties later broken. The residential-school system — begun under colonial policy and continued by Canada — sought to erase Indigenous cultures.",
    events: [
      { year: "1670–1869", text: "The Hudson's Bay Company was granted a monopoly over 'Rupert's Land', a territory covering much of modern Canada, over the heads of its Indigenous inhabitants." },
      { year: "1880s–1996", text: "Residential schools removed Indigenous children from their families; Canada's Truth and Reconciliation Commission (2015) termed it 'cultural genocide'." },
    ],
    taken: "Indigenous land ceded under duress or unratified treaties; cultural and ceremonial objects held in UK and Canadian museums.",
    sources: [
      "Truth and Reconciliation Commission of Canada, Final Report (2015)",
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
      "Cutting across the empire, British ships trafficked more enslaved Africans than almost any other nation. When slavery was finally abolished, it was the slave-owners — not the enslaved — whom the British state chose to compensate, at a cost borne by taxpayers until the 21st century.",
    events: [
      { year: "1640s–1807", text: "British and British-colonial ships carried an estimated 3.1–3.4 million enslaved Africans across the Atlantic (Trans-Atlantic Slave Trade Database)." },
      { year: "1833", text: "The Slavery Abolition Act granted £20 million — about 40% of the Treasury's annual budget — to compensate roughly 47,000 slave-owners for their lost 'property'." },
      { year: "2015", text: "HM Treasury stated the loan raised to pay that compensation was only finally paid off by British taxpayers in 2015 (context and caveats noted by Full Fact)." },
    ],
    taken: "Generations of stolen African lives and labour; no reparation was ever paid to the enslaved or their descendants.",
    sources: [
      "Trans-Atlantic Slave Trade Database (slavevoyages.org)",
      "UCL 'Legacies of British Slavery' project",
      "HM Treasury (2018) & Full Fact on the 1833 compensation loan",
    ],
  },
];

// Region filter order used by the UI.
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
] as const;
