import type { Request, Response, NextFunction, RequestHandler } from "express";

export const complianceSecurityHeaders: RequestHandler = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader("X-Frame-Options", "DENY");

  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");

  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");

  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  res.setHeader("Permissions-Policy",
    "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), " +
    "camera=(self), cross-origin-isolated=(), display-capture=(), " +
    "document-domain=(), encrypted-media=(), execution-while-not-rendered=(), " +
    "execution-while-out-of-viewport=(), fullscreen=(self), geolocation=(), " +
    "gyroscope=(), hid=(), idle-detection=(), magnetometer=(), microphone=(self), " +
    "midi=(), navigation-override=(), payment=(), picture-in-picture=(self), " +
    "publickey-credentials-get=(self), screen-wake-lock=(), serial=(), " +
    "sync-xhr=(), usb=(), web-share=(self), xr-spatial-tracking=()"
  );

  res.setHeader("X-DNS-Prefetch-Control", "off");

  res.setHeader("X-Download-Options", "noopen");

  res.setHeader("Origin-Agent-Cluster", "?1");

  next();
};
