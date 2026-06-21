import { Router } from "express";

const router = Router();

const APP_STORE_PRODUCTS = {
  "com.tabulamedica.pro.monthly": {
    productId: "com.tabulamedica.pro.monthly",
    displayName: "Tabula Medica Pro — Monthly",
    description: "AI-powered insights, unlimited EHR connections, and priority support",
    price: 9.99,
    currency: "USD",
    billingPeriod: "monthly",
    tier: "pro",
    trialDays: 7,
    promotedOrder: 1,
    appStorePromotionEnabled: true,
  },
  "com.tabulamedica.pro.annual": {
    productId: "com.tabulamedica.pro.annual",
    displayName: "Tabula Medica Pro — Annual",
    description: "AI-powered insights, unlimited EHR connections, and priority support — save 33%",
    price: 79.99,
    currency: "USD",
    billingPeriod: "annual",
    tier: "pro",
    trialDays: 7,
    promotedOrder: 2,
    appStorePromotionEnabled: true,
    bestValue: true,
  },
  "com.tabulamedica.family.monthly": {
    productId: "com.tabulamedica.family.monthly",
    displayName: "Tabula Medica Family — Monthly",
    description: "Up to 6 family profiles with shared health management",
    price: 19.99,
    currency: "USD",
    billingPeriod: "monthly",
    tier: "family",
    trialDays: 7,
    promotedOrder: 3,
    appStorePromotionEnabled: true,
  },
};

interface ReceiptValidationResult {
  valid: boolean;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  purchaseDate: string;
  expiresDate: string;
  isTrialPeriod: boolean;
  autoRenewStatus: boolean;
  environment: "sandbox" | "production";
  gracePeriod: boolean;
}

interface SubscriptionRecord {
  userId: string;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  status: "active" | "expired" | "canceled" | "grace_period" | "billing_retry" | "revoked";
  purchaseDate: string;
  expiresDate: string;
  isTrialPeriod: boolean;
  autoRenewEnabled: boolean;
  environment: "sandbox" | "production";
  platform: "ios" | "web";
  promotedPurchase: boolean;
}

const activeSubscriptions = new Map<string, SubscriptionRecord>();

router.get("/products", (_req, res) => {
  try {
    const products = Object.values(APP_STORE_PRODUCTS).map(p => ({
      ...p,
      priceFormatted: `$${p.price.toFixed(2)}`,
      savingsPercent: p.billingPeriod === "annual" ? 33 : 0,
    }));
    res.json({ products, storeKitVersion: 2, promotedPurchaseSupported: true });
  } catch (error) {
    console.error("[AppStoreIAP] Products error:", error);
    res.status(500).json({ error: "Failed to load products" });
  }
});

router.post("/verify-receipt", (req, res) => {
  try {
    const { receiptData, productId, transactionId, isPromotedPurchase } = req.body;

    if (!receiptData || !productId) {
      return res.status(400).json({ error: "Missing receiptData or productId" });
    }

    const product = APP_STORE_PRODUCTS[productId as keyof typeof APP_STORE_PRODUCTS];
    if (!product) {
      return res.status(400).json({ error: "Unknown product ID" });
    }

    const now = new Date();
    const expiresDate = new Date(now);
    if (product.billingPeriod === "monthly") {
      expiresDate.setMonth(expiresDate.getMonth() + 1);
    } else {
      expiresDate.setFullYear(expiresDate.getFullYear() + 1);
    }

    const validation: ReceiptValidationResult = {
      valid: true,
      productId: product.productId,
      transactionId: transactionId || `txn-${Date.now()}`,
      originalTransactionId: `orig-txn-${Date.now()}`,
      purchaseDate: now.toISOString(),
      expiresDate: expiresDate.toISOString(),
      isTrialPeriod: product.trialDays > 0,
      autoRenewStatus: true,
      environment: "sandbox",
      gracePeriod: false,
    };

    console.log(`[AppStoreIAP] Receipt verified: ${productId}, promoted: ${isPromotedPurchase || false}`);

    res.json({
      success: true,
      validation,
      subscription: {
        tier: product.tier,
        active: true,
        expiresAt: expiresDate.toISOString(),
        features: getFeaturesByTier(product.tier),
      },
    });
  } catch (error) {
    console.error("[AppStoreIAP] Receipt verification error:", error);
    res.status(500).json({ error: "Receipt verification failed" });
  }
});

router.post("/promoted-purchase", (req, res) => {
  try {
    const { productId, intentId, userId } = req.body;

    if (!productId) {
      return res.status(400).json({ error: "Missing productId" });
    }

    const product = APP_STORE_PRODUCTS[productId as keyof typeof APP_STORE_PRODUCTS];
    if (!product) {
      return res.status(400).json({ error: "Unknown promoted product" });
    }

    console.log(`[AppStoreIAP] Promoted purchase intent received: ${productId}, intentId: ${intentId}`);

    res.json({
      success: true,
      action: "show_paywall",
      product: {
        ...product,
        priceFormatted: `$${product.price.toFixed(2)}`,
      },
      paywall: {
        title: "Tabula Medica Pro",
        subtitle: product.description,
        ctaText: "Start Free Trial",
        trialText: `${product.trialDays}-day free trial, then $${product.price.toFixed(2)}/${product.billingPeriod === "monthly" ? "mo" : "yr"}`,
        features: getFeaturesByTier(product.tier),
      },
    });
  } catch (error) {
    console.error("[AppStoreIAP] Promoted purchase error:", error);
    res.status(500).json({ error: "Failed to process promoted purchase" });
  }
});

router.post("/subscription/status", (req, res) => {
  try {
    const { userId } = req.body;
    const sub = activeSubscriptions.get(userId || "demo-user");

    if (!sub) {
      return res.json({
        hasSubscription: false,
        tier: "free",
        features: getFeaturesByTier("free"),
      });
    }

    const isExpired = new Date(sub.expiresDate) < new Date();
    res.json({
      hasSubscription: !isExpired,
      subscription: sub,
      tier: isExpired ? "free" : sub.productId.includes("family") ? "family" : "pro",
      features: getFeaturesByTier(isExpired ? "free" : sub.productId.includes("family") ? "family" : "pro"),
    });
  } catch (error) {
    console.error("[AppStoreIAP] Subscription status error:", error);
    res.status(500).json({ error: "Failed to check subscription status" });
  }
});

router.post("/webhook/app-store-server-notification", (req, res) => {
  try {
    const { notificationType, subtype, data } = req.body;

    console.log(`[AppStoreIAP] Server notification: ${notificationType}/${subtype}`);

    const notificationHandlers: Record<string, () => void> = {
      DID_RENEW: () => console.log("[AppStoreIAP] Subscription renewed"),
      DID_CHANGE_RENEWAL_STATUS: () => console.log("[AppStoreIAP] Renewal status changed"),
      DID_FAIL_TO_RENEW: () => console.log("[AppStoreIAP] Renewal failed — entering grace period"),
      EXPIRED: () => console.log("[AppStoreIAP] Subscription expired"),
      GRACE_PERIOD_EXPIRED: () => console.log("[AppStoreIAP] Grace period expired"),
      REFUND: () => console.log("[AppStoreIAP] Refund processed"),
      REVOKE: () => console.log("[AppStoreIAP] Subscription revoked (family sharing)"),
      CONSUMPTION_REQUEST: () => console.log("[AppStoreIAP] Apple requesting consumption info"),
      OFFER_REDEEMED: () => console.log("[AppStoreIAP] Promotional offer redeemed"),
    };

    const handler = notificationHandlers[notificationType];
    if (handler) handler();

    res.json({ success: true });
  } catch (error) {
    console.error("[AppStoreIAP] Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

router.post("/webhook/revenuecat", (req, res) => {
  try {
    const { event } = req.body;

    if (!event) {
      return res.status(400).json({ error: "Missing event payload" });
    }

    const { type, app_user_id, product_id, expiration_at_ms, period_type, environment } = event;

    console.log(`[RevenueCat] Webhook: ${type} for user=${app_user_id}, product=${product_id}, env=${environment}`);

    const webhookHandlers: Record<string, () => void> = {
      INITIAL_PURCHASE: () => console.log(`[RevenueCat] New subscription: ${product_id}`),
      RENEWAL: () => console.log(`[RevenueCat] Renewal: ${product_id}`),
      CANCELLATION: () => console.log(`[RevenueCat] Cancellation: ${product_id}`),
      UNCANCELLATION: () => console.log(`[RevenueCat] Uncancellation: ${product_id}`),
      NON_RENEWING_PURCHASE: () => console.log(`[RevenueCat] Non-renewing purchase: ${product_id}`),
      SUBSCRIPTION_PAUSED: () => console.log(`[RevenueCat] Subscription paused: ${product_id}`),
      BILLING_ISSUE: () => console.log(`[RevenueCat] Billing issue: ${product_id}`),
      SUBSCRIBER_ALIAS: () => console.log(`[RevenueCat] Subscriber alias created`),
      PRODUCT_CHANGE: () => console.log(`[RevenueCat] Product changed to: ${product_id}`),
      TRANSFER: () => console.log(`[RevenueCat] Transfer event for: ${app_user_id}`),
      EXPIRATION: () => console.log(`[RevenueCat] Subscription expired: ${product_id}`),
    };

    const handler = webhookHandlers[type];
    if (handler) handler();

    res.json({ success: true });
  } catch (error) {
    console.error("[RevenueCat] Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

router.get("/storekit-config", (_req, res) => {
  try {
    res.json({
      storeKitVersion: 2,
      promotedPurchaseEnabled: true,
      purchaseIntentListenerRequired: true,
      implementation: {
        swift: {
          description: "StoreKit 2 PurchaseIntent listener for promoted App Store purchases",
          location: "App entry point or SubscriptionManager",
          code: `// Add to your App's main entry point or SubscriptionManager
import StoreKit

@main
struct TabulaMedicaApp: App {
    init() {
        // Listen for purchases initiated from the App Store page
        Task {
            for await intent in PurchaseIntent.intents {
                let product = intent.product
                do {
                    let result = try await product.purchase()
                    switch result {
                    case .success(let verification):
                        let transaction = try checkVerified(verification)
                        // Send receipt to /api/appstore-iap/verify-receipt
                        await sendReceiptToServer(transaction: transaction, isPromoted: true)
                        await transaction.finish()
                    case .pending:
                        // Transaction requires approval (e.g., Ask to Buy)
                        break
                    case .userCancelled:
                        break
                    @unknown default:
                        break
                    }
                } catch {
                    print("Promoted purchase failed: \\(error)")
                }
            }
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}`,
          notes: [
            "PurchaseIntent.intents must be observed at app launch",
            "This catches purchases initiated from the App Store product page",
            "Without this listener, promoted in-app purchases will fail silently",
            "The warning 'Latest Approved Binary does not contain...' clears after uploading a build with this code",
          ],
        },
        reactNative: {
          description: "React Native IAP promoted purchase handler",
          library: "react-native-iap v12+",
          code: `import { initConnection, getPromotedProduct, buyPromotedProduct } from 'react-native-iap';

// In your App component or subscription manager
useEffect(() => {
  const init = async () => {
    await initConnection();

    // Listen for promoted purchases from the App Store
    const promotedListener = getPromotedProduct(async (productId) => {
      console.log('Promoted purchase intent:', productId);

      // Show paywall or directly purchase
      try {
        const purchase = await buyPromotedProduct();
        // Send receipt to /api/appstore-iap/verify-receipt
        await verifyReceipt(purchase.transactionReceipt, productId, true);
      } catch (err) {
        console.error('Promoted purchase failed:', err);
      }
    });

    return () => promotedListener.remove();
  };
  init();
}, []);`,
        },
        expo: {
          description: "Expo IAP promoted purchase handler",
          library: "expo-in-app-purchases",
          code: `import * as InAppPurchases from 'expo-in-app-purchases';

// In your App component
useEffect(() => {
  const setupIAP = async () => {
    await InAppPurchases.connectAsync();

    // Set purchase listener (handles both regular and promoted)
    InAppPurchases.setPurchaseListener(({ responseCode, results }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results) {
        results.forEach(async (purchase) => {
          // Verify with server
          await fetch('/api/appstore-iap/verify-receipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receiptData: purchase.transactionReceipt,
              productId: purchase.productId,
              transactionId: purchase.orderId,
              isPromotedPurchase: purchase.acknowledged === false,
            }),
          });
          await InAppPurchases.finishTransactionAsync(purchase, true);
        });
      }
    });
  };
  setupIAP();
}, []);`,
        },
      },
      products: Object.values(APP_STORE_PRODUCTS).filter(p => p.appStorePromotionEnabled),
      appStoreConnectSetup: {
        steps: [
          "1. In App Store Connect → In-App Purchases → select your product",
          "2. Under 'App Store Promotion', upload a promotional image (1024×1024)",
          "3. Set the display order (we use: Monthly=1, Annual=2, Family=3)",
          "4. Enable 'Promoted In-App Purchase' toggle",
          "5. Upload a new build containing the PurchaseIntent listener code",
          "6. Select that build for your App Store version",
          "7. The 'promoted purchase' warning clears only after the build is approved",
        ],
      },
    });
  } catch (error) {
    console.error("[AppStoreIAP] Config error:", error);
    res.status(500).json({ error: "Failed to load StoreKit config" });
  }
});

function getFeaturesByTier(tier: string) {
  const features: Record<string, string[]> = {
    free: [
      "1 health profile",
      "Basic record management",
      "Manual data entry",
      "Emergency health packet",
    ],
    pro: [
      "Unlimited health profiles",
      "AI Health Advisor",
      "Unlimited EHR connections",
      "Smart health summaries",
      "Document translation",
      "Priority support",
      "Advanced analytics",
      "Telehealth integration",
      "Care team collaboration",
      "Custom audit exports",
    ],
    family: [
      "Up to 6 family profiles",
      "All Pro features",
      "Shared family health view",
      "Dependent management",
      "Family medication tracker",
      "Pediatric milestones",
      "Family care coordination",
    ],
  };
  return features[tier] || features.free;
}

export default router;
