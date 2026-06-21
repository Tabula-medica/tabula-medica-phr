import { Router, Request, Response } from "express";
import { z } from "zod";
import type {
  DirectoryProvider,
  ProviderBookmark,
  DirectorySearchResult,
  ConnectionStatus,
  DirectoryProviderType,
} from "@shared/schema";
import { insertProviderBookmarkSchema } from "@shared/schema";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

const directoryProviders: Map<string, DirectoryProvider> = new Map();
const providerBookmarks: Map<string, ProviderBookmark> = new Map();

function initializeSampleProviders(): void {
  const now = new Date().toISOString();

  const sampleProviders: DirectoryProvider[] = [
    {
      id: "dp-1",
      npi: "1234567890",
      name: "Dr. Sarah Johnson, MD, FACC",
      type: "physician",
      specialties: ["Cardiology", "Internal Medicine"],
      primarySpecialty: "Cardiology",
      credentials: ["MD", "FACC"],
      organization: "Heart Care Associates",
      addressLine1: "100 Medical Center Drive",
      addressLine2: "Suite 300",
      city: "Boston",
      state: "MA",
      zipCode: "02115",
      phone: "(617) 555-1234",
      fax: "(617) 555-1235",
      email: "sjohnson@heartcare.com",
      website: "https://heartcareassociates.com",
      connectionStatus: "fhir_enabled",
      fhirBaseUrl: "https://fhir.heartcare.com/r4",
      ehrVendor: "Fasten Health",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English", "Spanish"],
      hospitalAffiliations: ["City General Hospital", "Memorial Heart Center"],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-2",
      npi: "0987654321",
      name: "Dr. Michael Chen, MD",
      type: "physician",
      specialties: ["Family Medicine", "Primary Care"],
      primarySpecialty: "Family Medicine",
      credentials: ["MD"],
      organization: "Family Health Partners",
      addressLine1: "250 Main Street",
      addressLine2: "Suite 400",
      city: "Boston",
      state: "MA",
      zipCode: "02110",
      phone: "(617) 555-2345",
      email: "mchen@familyhealthpartners.com",
      connectionStatus: "fhir_enabled",
      fhirBaseUrl: "https://fhir.familyhealth.com/r4",
      ehrVendor: "Hospital Network",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English", "Mandarin"],
      hospitalAffiliations: ["Community Medical Center"],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-3",
      npi: "5678901234",
      name: "Dr. Emily Rodriguez, MD, PhD",
      type: "specialist",
      specialties: ["Endocrinology", "Diabetes & Metabolism"],
      primarySpecialty: "Endocrinology",
      credentials: ["MD", "PhD"],
      organization: "University Endocrine Associates",
      addressLine1: "500 University Avenue",
      city: "Boston",
      state: "MA",
      zipCode: "02118",
      phone: "(617) 555-3456",
      email: "erodriguez@uniendocrine.com",
      connectionStatus: "direct_enabled",
      ehrVendor: "fastenhealth",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English", "Spanish", "Portuguese"],
      hospitalAffiliations: ["University Hospital"],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-4",
      name: "Boston General Hospital",
      type: "hospital",
      specialties: ["Emergency Medicine", "Surgery", "Cardiology", "Oncology", "Neurology"],
      addressLine1: "1000 Hospital Plaza",
      city: "Boston",
      state: "MA",
      zipCode: "02114",
      phone: "(617) 555-4567",
      fax: "(617) 555-4568",
      email: "info@bostongeneralhospital.org",
      website: "https://bostongeneralhospital.org",
      connectionStatus: "fhir_enabled",
      fhirBaseUrl: "https://fhir.bostongeneralhospital.org/r4",
      ehrVendor: "Fasten Health",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English"],
      hospitalAffiliations: [],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-5",
      name: "MedLab Diagnostics",
      type: "lab",
      specialties: ["Clinical Pathology", "Diagnostic Testing"],
      addressLine1: "75 Lab Way",
      city: "Cambridge",
      state: "MA",
      zipCode: "02139",
      phone: "(617) 555-5678",
      email: "orders@medlabdiagnostics.com",
      connectionStatus: "fhir_enabled",
      fhirBaseUrl: "https://api.medlabdiagnostics.com/fhir",
      ehrVendor: "Custom LIMS",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English"],
      hospitalAffiliations: [],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-6",
      name: "Advanced Imaging Center",
      type: "imaging",
      specialties: ["MRI", "CT Scan", "X-Ray", "Ultrasound", "PET Scan"],
      addressLine1: "200 Radiology Boulevard",
      city: "Boston",
      state: "MA",
      zipCode: "02120",
      phone: "(617) 555-6789",
      fax: "(617) 555-6790",
      email: "scheduling@advancedimaging.com",
      website: "https://advancedimaging.com",
      connectionStatus: "pending",
      ehrVendor: "Change Healthcare",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English", "Spanish"],
      hospitalAffiliations: ["Boston General Hospital"],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-7",
      npi: "3456789012",
      name: "Dr. James Wilson, MD",
      type: "specialist",
      specialties: ["Orthopedic Surgery", "Sports Medicine"],
      primarySpecialty: "Orthopedic Surgery",
      credentials: ["MD", "FAAOS"],
      organization: "Boston Orthopedic Specialists",
      addressLine1: "350 Surgeon's Way",
      city: "Boston",
      state: "MA",
      zipCode: "02116",
      phone: "(617) 555-7890",
      email: "jwilson@bostonortho.com",
      website: "https://bostonortho.com",
      connectionStatus: "manual_only",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English"],
      hospitalAffiliations: ["Boston General Hospital", "Sports Medicine Center"],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-8",
      npi: "4567890123",
      name: "Dr. Lisa Park, MD",
      type: "specialist",
      specialties: ["Dermatology", "Mohs Surgery"],
      primarySpecialty: "Dermatology",
      credentials: ["MD", "FAAD"],
      organization: "Clear Skin Dermatology",
      addressLine1: "125 Derma Lane",
      city: "Cambridge",
      state: "MA",
      zipCode: "02140",
      phone: "(617) 555-8901",
      email: "lpark@clearskin.com",
      connectionStatus: "not_connected",
      acceptingNewPatients: false,
      acceptingReferrals: true,
      languages: ["English", "Korean"],
      hospitalAffiliations: ["University Hospital"],
      networkStatus: "out_of_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-9",
      name: "Wellness Pharmacy",
      type: "pharmacy",
      specialties: ["Retail Pharmacy", "Compounding", "Specialty Medications"],
      addressLine1: "50 Pharmacy Street",
      city: "Boston",
      state: "MA",
      zipCode: "02111",
      phone: "(617) 555-9012",
      fax: "(617) 555-9013",
      email: "rx@wellnesspharmacy.com",
      connectionStatus: "fhir_enabled",
      fhirBaseUrl: "https://api.wellnesspharmacy.com/fhir/r4",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English", "Spanish", "Vietnamese"],
      hospitalAffiliations: [],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "dp-10",
      npi: "6789012345",
      name: "Dr. Robert Martinez, MD",
      type: "physician",
      specialties: ["Psychiatry", "Addiction Medicine"],
      primarySpecialty: "Psychiatry",
      credentials: ["MD", "FAPA"],
      organization: "Boston Behavioral Health",
      addressLine1: "400 Mental Health Drive",
      city: "Boston",
      state: "MA",
      zipCode: "02125",
      phone: "(617) 555-0123",
      email: "rmartinez@bostonbh.com",
      connectionStatus: "direct_enabled",
      acceptingNewPatients: true,
      acceptingReferrals: true,
      languages: ["English", "Spanish"],
      hospitalAffiliations: ["McLean Hospital"],
      networkStatus: "in_network",
      lastVerified: now,
      createdAt: now,
      updatedAt: now,
    },
  ];

  sampleProviders.forEach((p) => directoryProviders.set(p.id, p));
}

initializeSampleProviders();

function getClinicianId(req: Request): string {
  return (req as any).session?.userId || "clinician-default";
}

router.get("/search", async (req: Request, res: Response) => {
  try {
    const clinicianId = getClinicianId(req);
    const {
      query,
      type,
      specialty,
      city,
      state,
      connectionStatus,
      acceptingReferrals,
      bookmarkedOnly,
      page = "1",
      limit = "20",
    } = req.query;

    let providers = Array.from(directoryProviders.values());

    if (query && typeof query === "string") {
      const searchLower = query.toLowerCase();
      providers = providers.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.specialties.some((s) => s.toLowerCase().includes(searchLower)) ||
          p.organization?.toLowerCase().includes(searchLower) ||
          p.city.toLowerCase().includes(searchLower)
      );
    }

    if (type && typeof type === "string") {
      providers = providers.filter((p) => p.type === type);
    }

    if (specialty && typeof specialty === "string") {
      const specLower = specialty.toLowerCase();
      providers = providers.filter((p) =>
        p.specialties.some((s) => s.toLowerCase().includes(specLower))
      );
    }

    if (city && typeof city === "string") {
      providers = providers.filter((p) =>
        p.city.toLowerCase() === city.toLowerCase()
      );
    }

    if (state && typeof state === "string") {
      providers = providers.filter((p) =>
        p.state.toLowerCase() === state.toLowerCase()
      );
    }

    if (connectionStatus && typeof connectionStatus === "string") {
      providers = providers.filter((p) => p.connectionStatus === connectionStatus);
    }

    if (acceptingReferrals === "true") {
      providers = providers.filter((p) => p.acceptingReferrals);
    }

    const clinicianBookmarks = Array.from(providerBookmarks.values()).filter(
      (b) => b.clinicianId === clinicianId
    );
    const bookmarkedIds = new Set(clinicianBookmarks.map((b) => b.providerId));

    if (bookmarkedOnly === "true") {
      providers = providers.filter((p) => bookmarkedIds.has(p.id));
    }

    const totalCount = providers.length;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIdx = (pageNum - 1) * limitNum;
    const paginatedProviders = providers.slice(startIdx, startIdx + limitNum);

    const result: DirectorySearchResult = {
      providers: paginatedProviders.map((p) => ({
        ...p,
        isBookmarked: bookmarkedIds.has(p.id),
      })),
      totalCount,
      page: pageNum,
      hasMore: startIdx + limitNum < totalCount,
    };

    logPhiAccess({
      userId: clinicianId,
      action: "read",
      resourceType: "DirectoryProvider",
      details: `Searched providers: query="${query || ""}", type="${type || ""}", results=${totalCount}`,
    });

    res.json(result);
  } catch (error) {
    console.error("Provider directory search error:", error);
    res.status(500).json({ error: "Failed to search providers" });
  }
});

router.get("/specialties", async (_req: Request, res: Response) => {
  try {
    const specialtiesSet = new Set<string>();
    directoryProviders.forEach((p) => {
      p.specialties.forEach((s) => specialtiesSet.add(s));
    });
    res.json(Array.from(specialtiesSet).sort());
  } catch (error) {
    res.status(500).json({ error: "Failed to get specialties" });
  }
});

router.get("/cities", async (_req: Request, res: Response) => {
  try {
    const citiesSet = new Set<string>();
    directoryProviders.forEach((p) => citiesSet.add(p.city));
    res.json(Array.from(citiesSet).sort());
  } catch (error) {
    res.status(500).json({ error: "Failed to get cities" });
  }
});

router.get("/providers/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const clinicianId = getClinicianId(req);
    const provider = directoryProviders.get(id);

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const bookmark = Array.from(providerBookmarks.values()).find(
      (b) => b.clinicianId === clinicianId && b.providerId === id
    );

    logPhiAccess({
      userId: clinicianId,
      action: "read",
      resourceType: "DirectoryProvider",
      resourceId: id,
      details: `Viewed provider details: ${provider.name}`,
    });

    res.json({
      ...provider,
      isBookmarked: !!bookmark,
      bookmarkNotes: bookmark?.notes,
      bookmarkTags: bookmark?.tags,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to get provider details" });
  }
});

router.post("/bookmarks", async (req: Request, res: Response) => {
  try {
    const clinicianId = getClinicianId(req);
    const parsed = insertProviderBookmarkSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid bookmark data", details: parsed.error });
    }

    const { providerId, notes, tags } = parsed.data;
    const provider = directoryProviders.get(providerId);

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const existing = Array.from(providerBookmarks.values()).find(
      (b) => b.clinicianId === clinicianId && b.providerId === providerId
    );

    if (existing) {
      return res.status(400).json({ error: "Provider already bookmarked" });
    }

    const bookmark: ProviderBookmark = {
      id: `bookmark-${Date.now()}`,
      clinicianId,
      providerId,
      notes,
      tags,
      createdAt: new Date().toISOString(),
    };

    providerBookmarks.set(bookmark.id, bookmark);

    logPhiAccess({
      userId: clinicianId,
      action: "write",
      resourceType: "ProviderBookmark",
      resourceId: bookmark.id,
      details: `Bookmarked provider: ${provider.name}`,
    });

    res.status(201).json(bookmark);
  } catch (error) {
    console.error("Bookmark creation error:", error);
    res.status(500).json({ error: "Failed to create bookmark" });
  }
});

router.delete("/bookmarks/:providerId", async (req: Request, res: Response) => {
  try {
    const clinicianId = getClinicianId(req);
    const { providerId } = req.params;

    const bookmark = Array.from(providerBookmarks.values()).find(
      (b) => b.clinicianId === clinicianId && b.providerId === providerId
    );

    if (!bookmark) {
      return res.status(404).json({ error: "Bookmark not found" });
    }

    providerBookmarks.delete(bookmark.id);

    logPhiAccess({
      userId: clinicianId,
      action: "delete",
      resourceType: "ProviderBookmark",
      resourceId: bookmark.id,
      details: `Removed bookmark for provider: ${providerId}`,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete bookmark" });
  }
});

router.get("/bookmarks", async (req: Request, res: Response) => {
  try {
    const clinicianId = getClinicianId(req);

    const clinicianBookmarks = Array.from(providerBookmarks.values()).filter(
      (b) => b.clinicianId === clinicianId
    );

    const bookmarkedProviders = clinicianBookmarks
      .map((b) => {
        const provider = directoryProviders.get(b.providerId);
        if (!provider) return null;
        return {
          ...provider,
          isBookmarked: true,
          bookmarkNotes: b.notes,
          bookmarkTags: b.tags,
          bookmarkedAt: b.createdAt,
        };
      })
      .filter(Boolean);

    res.json(bookmarkedProviders);
  } catch (error) {
    res.status(500).json({ error: "Failed to get bookmarks" });
  }
});

router.patch("/bookmarks/:providerId", async (req: Request, res: Response) => {
  try {
    const clinicianId = getClinicianId(req);
    const { providerId } = req.params;
    const { notes, tags } = req.body;

    const bookmark = Array.from(providerBookmarks.values()).find(
      (b) => b.clinicianId === clinicianId && b.providerId === providerId
    );

    if (!bookmark) {
      return res.status(404).json({ error: "Bookmark not found" });
    }

    if (notes !== undefined) bookmark.notes = notes;
    if (tags !== undefined) bookmark.tags = tags;

    providerBookmarks.set(bookmark.id, bookmark);

    logPhiAccess({
      userId: clinicianId,
      action: "write",
      resourceType: "ProviderBookmark",
      resourceId: bookmark.id,
      details: `Updated bookmark for provider: ${providerId}`,
    });

    res.json(bookmark);
  } catch (error) {
    res.status(500).json({ error: "Failed to update bookmark" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const clinicianId = getClinicianId(req);
    const providers = Array.from(directoryProviders.values());
    const bookmarks = Array.from(providerBookmarks.values()).filter(
      (b) => b.clinicianId === clinicianId
    );

    const stats = {
      totalProviders: providers.length,
      bookmarkedCount: bookmarks.length,
      byType: {} as Record<string, number>,
      byConnectionStatus: {} as Record<string, number>,
      acceptingReferrals: providers.filter((p) => p.acceptingReferrals).length,
      fhirEnabled: providers.filter((p) => p.connectionStatus === "fhir_enabled").length,
    };

    providers.forEach((p) => {
      stats.byType[p.type] = (stats.byType[p.type] || 0) + 1;
      stats.byConnectionStatus[p.connectionStatus] = (stats.byConnectionStatus[p.connectionStatus] || 0) + 1;
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: "Failed to get directory stats" });
  }
});

export default router;
