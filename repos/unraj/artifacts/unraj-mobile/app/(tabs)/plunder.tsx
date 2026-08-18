import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CountryLedgerCard } from "@/components/CountryLedgerCard";
import { PlunderCard } from "@/components/PlunderCard";
import { StatBlock } from "@/components/StatBlock";
import { EMPIRE_LEDGER, LEDGER_REGIONS } from "@/data/empireLedger";
import { useColors } from "@/hooks/useColors";

const PLUNDER_DATA = [
  {
    region: "India",
    artifact: "Kohinoor Diamond",
    year: "1849",
    detail:
      "Seized from 10-year-old Maharaja Duleep Singh after the Anglo-Sikh wars. Now in the Tower of London.",
    history:
      "The Kohinoor ('Mountain of Light') is a 105.6-carat diamond with origins traced to the Kollur Mine in Andhra Pradesh, India, dating back to the 13th century. It passed through the hands of the Mughal emperors, Nader Shah of Persia, and the Afghan Durrani dynasty before reaching Maharaja Ranjit Singh of the Sikh Empire. After the British defeated the Sikhs in 1849, the Treaty of Lahore forced 10-year-old Maharaja Duleep Singh to surrender the diamond. It was presented to Queen Victoria in 1850 and was recut from 186 carats to its current size. India, Pakistan, Iran, and Afghanistan have all formally demanded its return.",
    currentLocation: "Tower of London, UK",
    estimatedValue: "Priceless (est. $200M+)",
    repatriationStatus: "India has repeatedly demanded its return. The UK government maintains it was obtained legally under the Treaty of Lahore. The diamond remains a symbol of colonial extraction.",
    icon: "star" as const,
  },
  {
    region: "India",
    artifact: "Tipu Sultan's Tiger",
    year: "1799",
    detail:
      "Mechanical automaton looted from the palace of Tipu Sultan after the Siege of Seringapatam.",
    history:
      "Tipu Sultan, the 'Tiger of Mysore,' was one of the fiercest opponents of British colonialism in India. His wooden automaton, depicting a tiger mauling a European soldier, was a symbol of his resistance. When the British stormed his capital Seringapatam in 1799, Tipu was killed defending his fortress. British soldiers looted his palace, taking the tiger automaton along with his throne, jeweled sword, ring, and personal library. The automaton contains a pipe organ that simulates the cries of the soldier. It became a popular exhibit at the East India Company's museum and later the V&A.",
    currentLocation: "Victoria & Albert Museum, London",
    estimatedValue: "Est. £5–10M",
    repatriationStatus: "No formal repatriation process. India considers it among the most significant looted artifacts. The V&A has displayed it continuously since 1808.",
    icon: "shield" as const,
  },
  {
    region: "Africa",
    artifact: "Benin Bronzes",
    year: "1897",
    detail:
      "Over 900 sculptures seized during the British Punitive Expedition against Benin City, Nigeria.",
    history:
      "In February 1897, a British force of 1,200 soldiers invaded the Kingdom of Benin (in present-day Nigeria) in retaliation for an ambush on a previous British delegation. They burned Benin City to the ground and looted the royal palace, seizing over 4,000 brass plaques, ivory carvings, and bronze sculptures dating from the 13th century onward. These masterworks — which Europeans had believed Africans incapable of creating — were sold to museums across the world. The bronzes represent one of the most significant cases of cultural theft in history. Germany returned 1,130 bronzes in 2022; the Smithsonian and other institutions have followed.",
    currentLocation: "British Museum (900+), plus museums in Germany, USA, France",
    estimatedValue: "Est. £500M+ collectively",
    repatriationStatus: "Partial repatriation underway. Germany returned 1,130 pieces in 2022. The British Museum refuses to return its collection, citing the British Museum Act 1963 which prohibits deaccessioning.",
    icon: "hexagon" as const,
  },
  {
    region: "Middle East",
    artifact: "Rosetta Stone",
    year: "1801",
    detail:
      "Taken from Egypt under the Treaty of Alexandria. Essential for deciphering hieroglyphics.",
    history:
      "The Rosetta Stone is a granodiorite stele inscribed in 196 BC with a decree in three scripts: Ancient Egyptian hieroglyphics, Demotic, and Ancient Greek. French soldiers discovered it in 1799 during Napoleon's campaign in Egypt near the town of Rashid (Rosetta). When the British defeated the French in Egypt in 1801, they seized the stone under the terms of the Treaty of Alexandria, along with other antiquities. It was shipped to England and placed in the British Museum in 1802. Jean-François Champollion used it to decipher hieroglyphics in 1822, unlocking thousands of years of Egyptian history. Egypt has formally requested its return multiple times since 2003.",
    currentLocation: "British Museum, London",
    estimatedValue: "Priceless — culturally irreplaceable",
    repatriationStatus: "Egypt's Supreme Council of Antiquities has made formal repatriation requests since 2003. Dr. Zahi Hawass has called it 'the icon of Egyptian identity.' The British Museum refuses to return it.",
    icon: "book" as const,
  },
  {
    region: "China",
    artifact: "Summer Palace Treasures",
    year: "1860",
    detail:
      "Thousands of objects looted and the Old Summer Palace burned during the Second Opium War.",
    history:
      "The Old Summer Palace (Yuanmingyuan) in Beijing was one of the greatest architectural achievements in human history — a sprawling complex of 200+ buildings, gardens, and temples that took 150 years to build. In October 1860, during the Second Opium War, British and French troops looted the palace over several days, taking gold, jade, porcelain, silk, and bronze treasures. Lord Elgin then ordered the palace burned to the ground — it took 3,500 troops three days to destroy it. Victor Hugo called it 'one of the wonders of the world' and condemned the destruction. An estimated 1.5 million objects were stolen, many now scattered across European museums and private collections.",
    currentLocation: "British Museum, V&A, Fontainebleau, private collections worldwide",
    estimatedValue: "Est. £10B+ collectively",
    repatriationStatus: "China considers the destruction a national humiliation. Individual objects have been returned through purchases and donations, but the vast majority remain abroad. The Chinese government has increased efforts to recover lost artifacts.",
    icon: "home" as const,
  },
  {
    region: "Pacific",
    artifact: "Moai Head (Hoa Hakananai'a)",
    year: "1868",
    detail:
      "Sacred Rapa Nui ancestor figure taken from Easter Island. Now in the British Museum.",
    history:
      "Hoa Hakananai'a ('Stolen or Hidden Friend') is a moai — a monolithic ancestor figure carved by the Rapa Nui people of Easter Island around 1000 AD. Standing 2.4 meters tall and weighing 4 tonnes, it was carved from basalt and placed in the ceremonial village of Orongo. In 1868, the crew of HMS Topaze, led by Captain Richard Powell, removed the statue and transported it to England as a gift for Queen Victoria, who gave it to the British Museum. The Rapa Nui people consider it one of their most sacred ancestors. The Governor of Easter Island formally requested its return in 2018, describing it as 'the soul of our people.'",
    currentLocation: "British Museum, London",
    estimatedValue: "Priceless — sacred cultural artifact",
    repatriationStatus: "Chile and the Rapa Nui community have made formal requests for return. In 2018, the Governor of Easter Island traveled to London to personally request repatriation. The British Museum offered to loan (not return) the statue.",
    icon: "globe" as const,
  },
  {
    region: "Americas",
    artifact: "Aztec Turquoise Mosaic Mask",
    year: "c. 1520",
    detail:
      "Ceremonial mask attributed to the god Tezcatlipoca, likely taken during the Spanish-British colonial period.",
    history:
      "This striking mosaic mask is believed to represent Tezcatlipoca, the Aztec god of the night sky, memory, and time. Made from a human skull lined with turquoise, jet, and shell mosaic, it dates to the 15th–16th century Aztec Empire. The mask was likely among the treasures seized during the Spanish conquest of the Aztec Empire under Hernán Cortés in 1519–1521, when the great city of Tenochtitlan was destroyed. The mask passed through various European collections before reaching the British Museum. It represents the sophisticated artistry of Mesoamerican civilizations that European colonizers sought to erase. Mexico has called for the return of Aztec artifacts held in foreign museums.",
    currentLocation: "British Museum, London",
    estimatedValue: "Est. £5M+",
    repatriationStatus: "Mexico has made broad calls for the repatriation of pre-Columbian artifacts. No specific formal claim has been filed for this mask, but it remains part of ongoing discussions about decolonizing museum collections worldwide.",
    icon: "circle" as const,
  },
];

const STATS = [
  { value: "100K+", label: "Artifacts\nstolen" },
  { value: "50+", label: "Countries\nplundered" },
  { value: "£35T", label: "Wealth\nextracted" },
];

export default function PlunderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState("All");

  const ledgerEntries =
    region === "All"
      ? EMPIRE_LEDGER
      : EMPIRE_LEDGER.filter((e) => e.region === region);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop:
              Platform.OS === "web" ? 67 : Math.max(insets.top + 8, 20),
            paddingBottom:
              Platform.OS === "web" ? 34 + 84 : insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={styles.header}
          accessible={true}
          accessibilityLabel="A Global Crime. The Plunder Never Stopped. Britain's empire looted heritage from every continent. These are just a few of the countless artifacts that must be returned."
        >
          <Text
            style={[styles.tagline, { color: colors.primary }]}
            maxFontSizeMultiplier={2}
          >
            A GLOBAL CRIME
          </Text>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={2}
          >
            The Plunder{"\n"}Never Stopped
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.mutedForeground }]}
            maxFontSizeMultiplier={2}
          >
            Britain's empire looted heritage from every continent. These are
            just a few of the countless artifacts that must be returned.
          </Text>
          <Text
            style={[styles.tapHint, { color: colors.mutedForeground }]}
            maxFontSizeMultiplier={2}
          >
            Tap any card below to read the full history
          </Text>
        </View>

        <View
          style={styles.statsRow}
          accessibilityRole="summary"
          accessibilityLabel="Key statistics: Over 100 thousand artifacts stolen, from over 50 countries plundered, totaling 35 trillion pounds of wealth extracted"
        >
          {STATS.map((s) => (
            <StatBlock key={s.label} value={s.value} label={s.label} />
          ))}
        </View>

        <View style={styles.cards}>
          {PLUNDER_DATA.map((item) => (
            <PlunderCard key={item.artifact} {...item} />
          ))}
        </View>

        <View
          style={styles.ledgerHeader}
          accessible
          accessibilityLabel="The Empire Ledger. One flag, every continent. A country-by-country record of what British rule took, and what has never been returned. Authenticated history only, with sources on every card."
        >
          <Text style={[styles.tagline, { color: colors.primary }]} maxFontSizeMultiplier={2}>
            THE EMPIRE LEDGER
          </Text>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={2}
          >
            One Flag.{"\n"}Every Continent.
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} maxFontSizeMultiplier={2}>
            A country-by-country record of what British rule took — and what has
            never been returned. This is the greedy past we must UnRaj.
          </Text>
          <Text style={[styles.tapHint, { color: colors.mutedForeground }]} maxFontSizeMultiplier={2}>
            Authenticated history only — every card cites its sources.
          </Text>
        </View>

        <View style={styles.filterRow}>
          {LEDGER_REGIONS.map((r) => {
            const active = region === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRegion(r)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter by ${r === "All" ? "all regions" : r}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                  maxFontSizeMultiplier={2}
                >
                  {r === "All" ? "All Regions" : r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.cards}>
          {ledgerEntries.map((entry) => (
            <CountryLedgerCard key={entry.id} entry={entry} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20 },
  header: {
    alignItems: "center",
    paddingTop: 20,
    gap: 10,
    marginBottom: 24,
  },
  tagline: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  tapHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontStyle: "italic",
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  cards: {
    gap: 0,
  },
  ledgerHeader: {
    alignItems: "center",
    paddingTop: 12,
    gap: 10,
    marginTop: 12,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
