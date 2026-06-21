import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type AppRegion = "us" | "international";

interface RegionContextType {
  region: AppRegion;
  setRegion: (region: AppRegion) => void;
  isUS: boolean;
  isLoading: boolean;
}

const RegionContext = createContext<RegionContextType>({
  region: "international",
  setRegion: () => {},
  isUS: false,
  isLoading: true,
});

const US_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "America/Adak",
  "America/Honolulu",
  "America/Boise",
  "America/Indiana",
  "America/Detroit",
  "America/Kentucky",
  "America/Menominee",
  "America/Nome",
  "America/Juneau",
  "America/Sitka",
  "America/Yakutat",
  "America/Metlakatla",
  "Pacific/Honolulu",
  "US/Eastern",
  "US/Central",
  "US/Mountain",
  "US/Pacific",
  "US/Alaska",
  "US/Hawaii",
];

function detectRegion(): AppRegion {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (US_TIMEZONES.some((usTz) => tz.startsWith(usTz))) {
      return "us";
    }
    if (navigator.language === "en-US" || navigator.languages?.includes("en-US")) {
      return "us";
    }
  } catch {}
  return "international";
}

const STORAGE_KEY = "tabula-medica-region";

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<AppRegion>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "us" || stored === "international") return stored;
    return detectRegion();
  });
  const [isLoading, setIsLoading] = useState(false);

  const { data: serverRegion } = useQuery<{ region: AppRegion }>({
    queryKey: ["/api/region-preference"],
  });

  useEffect(() => {
    if (serverRegion?.region && !localStorage.getItem(STORAGE_KEY)) {
      setRegionState(serverRegion.region);
      localStorage.setItem(STORAGE_KEY, serverRegion.region);
    }
  }, [serverRegion]);

  const saveRegionMutation = useMutation({
    mutationFn: async (newRegion: AppRegion) => {
      const response = await apiRequest("PUT", "/api/region-preference", { region: newRegion });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/region-preference"] });
    },
  });

  const setRegion = useCallback((newRegion: AppRegion) => {
    setRegionState(newRegion);
    localStorage.setItem(STORAGE_KEY, newRegion);
    saveRegionMutation.mutate(newRegion);
  }, [saveRegionMutation]);

  return (
    <RegionContext.Provider value={{ region, setRegion, isUS: region === "us", isLoading }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
