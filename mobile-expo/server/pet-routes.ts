// @ts-nocheck
import { Router, Request, Response } from "express";
import { db } from "./db";
import { petProfiles, petHealthRecords, petStateRegistrations } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { createHash } from "crypto";

const router = Router();

function getHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || getHeader(req, "x-user-id") || "";
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const pets = await db.select().from(petProfiles).where(and(eq(petProfiles.userId, userId), eq(petProfiles.isActive, true))).orderBy(desc(petProfiles.createdAt));
    res.json(pets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { name, species, breed, dateOfBirth, weight, weightUnit, gender, color, microchipId, licenseNumber, licenseState, veterinarian, vetClinic, vetPhone, photoUri, notes } = req.body;
    if (!name || !species) return res.status(400).json({ error: "Name and species are required" });
    const [pet] = await db.insert(petProfiles).values({
      userId,
      name,
      species,
      breed: breed || null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      weight: weight ? parseFloat(weight) : null,
      weightUnit: weightUnit || "lbs",
      gender: gender || null,
      color: color || null,
      microchipId: microchipId || null,
      licenseNumber: licenseNumber || null,
      licenseState: licenseState || null,
      veterinarian: veterinarian || null,
      vetClinic: vetClinic || null,
      vetPhone: vetPhone || null,
      photoUri: photoUri || null,
      notes: notes || null,
    }).returning();
    res.status(201).json(pet);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const petId = req.params.id;
    const [pet] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    res.json(pet);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const petId = req.params.id;
    const [existing] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Pet not found" });
    const { name, species, breed, dateOfBirth, weight, weightUnit, gender, color, microchipId, licenseNumber, licenseState, veterinarian, vetClinic, vetPhone, photoUri, notes, isActive } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (species !== undefined) updates.species = species;
    if (breed !== undefined) updates.breed = breed;
    if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (weight !== undefined) updates.weight = weight ? parseFloat(weight) : null;
    if (weightUnit !== undefined) updates.weightUnit = weightUnit;
    if (gender !== undefined) updates.gender = gender;
    if (color !== undefined) updates.color = color;
    if (microchipId !== undefined) updates.microchipId = microchipId;
    if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
    if (licenseState !== undefined) updates.licenseState = licenseState;
    if (veterinarian !== undefined) updates.veterinarian = veterinarian;
    if (vetClinic !== undefined) updates.vetClinic = vetClinic;
    if (vetPhone !== undefined) updates.vetPhone = vetPhone;
    if (photoUri !== undefined) updates.photoUri = photoUri;
    if (notes !== undefined) updates.notes = notes;
    if (isActive !== undefined) updates.isActive = isActive;
    const [updated] = await db.update(petProfiles).set(updates).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId))).returning();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const petId = req.params.id;
    const [existing] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Pet not found" });
    const [deleted] = await db.update(petProfiles).set({ isActive: false, updatedAt: new Date() }).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId))).returning();
    res.json({ success: true, pet: deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:petId/records", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const petId = req.params.petId;
    const [pet] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    const records = await db.select().from(petHealthRecords).where(and(eq(petHealthRecords.petId, petId), eq(petHealthRecords.userId, userId))).orderBy(desc(petHealthRecords.date));
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:petId/records", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const petId = req.params.petId;
    const [pet] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    const { type, title, summary, date, provider, facility, details, reminderDate, notes } = req.body;
    if (!type || !title || !date) return res.status(400).json({ error: "Type, title, and date are required" });
    const [record] = await db.insert(petHealthRecords).values({
      petId,
      userId,
      type,
      title,
      summary: summary || null,
      date: new Date(date),
      provider: provider || null,
      facility: facility || null,
      details: details || null,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
      notes: notes || null,
    }).returning();
    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:petId/records/:recordId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { petId, recordId } = req.params;
    const [pet] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    const [existing] = await db.select().from(petHealthRecords).where(and(eq(petHealthRecords.id, recordId), eq(petHealthRecords.petId, petId), eq(petHealthRecords.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Record not found" });
    const { type, title, summary, date, provider, facility, details, reminderDate, notes } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (type !== undefined) updates.type = type;
    if (title !== undefined) updates.title = title;
    if (summary !== undefined) updates.summary = summary;
    if (date !== undefined) updates.date = new Date(date);
    if (provider !== undefined) updates.provider = provider;
    if (facility !== undefined) updates.facility = facility;
    if (details !== undefined) updates.details = details;
    if (reminderDate !== undefined) updates.reminderDate = reminderDate ? new Date(reminderDate) : null;
    if (notes !== undefined) updates.notes = notes;
    const [updated] = await db.update(petHealthRecords).set(updates).where(and(eq(petHealthRecords.id, recordId), eq(petHealthRecords.petId, petId), eq(petHealthRecords.userId, userId))).returning();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:petId/records/:recordId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { petId, recordId } = req.params;
    const [pet] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    const [existing] = await db.select().from(petHealthRecords).where(and(eq(petHealthRecords.id, recordId), eq(petHealthRecords.petId, petId), eq(petHealthRecords.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Record not found" });
    await db.delete(petHealthRecords).where(and(eq(petHealthRecords.id, recordId), eq(petHealthRecords.petId, petId), eq(petHealthRecords.userId, userId)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:petId/registrations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const petId = req.params.petId;
    const [pet] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    const registrations = await db.select().from(petStateRegistrations).where(and(eq(petStateRegistrations.petId, petId), eq(petStateRegistrations.userId, userId))).orderBy(desc(petStateRegistrations.createdAt));
    res.json(registrations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:petId/registrations", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const petId = req.params.petId;
    const [pet] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    const { state, registrationType, registrationNumber, issuedDate, expirationDate, status, registryUrl } = req.body;
    if (!state || !registrationType) return res.status(400).json({ error: "State and registration type are required" });
    const [registration] = await db.insert(petStateRegistrations).values({
      petId,
      userId,
      state,
      registrationType,
      registrationNumber: registrationNumber || null,
      issuedDate: issuedDate ? new Date(issuedDate) : null,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      status: status || "active",
      registryUrl: registryUrl || null,
    }).returning();
    res.status(201).json(registration);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:petId/registrations/:regId", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { petId, regId } = req.params;
    const [pet] = await db.select().from(petProfiles).where(and(eq(petProfiles.id, petId), eq(petProfiles.userId, userId)));
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    const [existing] = await db.select().from(petStateRegistrations).where(and(eq(petStateRegistrations.id, regId), eq(petStateRegistrations.petId, petId), eq(petStateRegistrations.userId, userId)));
    if (!existing) return res.status(404).json({ error: "Registration not found" });
    const { state, registrationType, registrationNumber, issuedDate, expirationDate, status, registryUrl, lastChecked } = req.body;
    const updates: any = {};
    if (state !== undefined) updates.state = state;
    if (registrationType !== undefined) updates.registrationType = registrationType;
    if (registrationNumber !== undefined) updates.registrationNumber = registrationNumber;
    if (issuedDate !== undefined) updates.issuedDate = issuedDate ? new Date(issuedDate) : null;
    if (expirationDate !== undefined) updates.expirationDate = expirationDate ? new Date(expirationDate) : null;
    if (status !== undefined) updates.status = status;
    if (registryUrl !== undefined) updates.registryUrl = registryUrl;
    if (lastChecked !== undefined) updates.lastChecked = lastChecked ? new Date(lastChecked) : null;
    const [updated] = await db.update(petStateRegistrations).set(updates).where(and(eq(petStateRegistrations.id, regId), eq(petStateRegistrations.petId, petId), eq(petStateRegistrations.userId, userId))).returning();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
