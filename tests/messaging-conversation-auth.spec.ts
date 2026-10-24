import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

interface AuthedRequest extends Request {
  user?: { claims?: { sub?: string; first_name?: string; last_name?: string } };
}

vi.mock("../server/replit_integrations/auth", () => ({
  isAuthenticated: (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.user?.claims?.sub) return next();
    return res.status(401).json({ message: "Unauthorized" });
  },
}));

vi.mock("../server/storage", () => ({
  storage: {},
}));

import { registerMessagingRoutes } from "../server/messaging-routes";

describe("POST /api/messaging/conversations", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json({ limit: "1mb" }));
    app.use((req: AuthedRequest, _res, next) => {
      if (req.headers["x-test-user"] === "1") {
        req.user = {
          claims: { sub: "user-1", first_name: "Ada", last_name: "Lovelace" },
        };
      }
      next();
    });
    registerMessagingRoutes(app);
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("rejects an unauthenticated constrained participantIds array before zod parse", async () => {
    const res = await fetch(`${base}/api/messaging/conversations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "group",
        profileId: "p",
        participantIds: ["", "", ""],
      }),
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "Unauthorized" });
  });

  it("creates a conversation once requireUser has a subject", async () => {
    const res = await fetch(`${base}/api/messaging/conversations`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-test-user": "1" },
      body: JSON.stringify({
        type: "patient_caregiver",
        profileId: "profile-1",
        participantIds: ["caregiver-9"],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.createdBy).toBe("user-1");
    expect(body.participantIds).toEqual(["user-1", "caregiver-9"]);
  });
});
