import React, { createContext, useContext, useEffect, useRef } from "react";
import { Platform } from "react-native";
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
} from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/feature-flags";

const REVENUECAT_TEST_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY =
  process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "pro";

let isConfigured = false;

function getRevenueCatApiKey(): string | null {
  if (__DEV__ || Platform.OS === "web") {
    return REVENUECAT_TEST_API_KEY || null;
  }

  if (
    Constants.executionEnvironment === "storeClient" &&
    REVENUECAT_TEST_API_KEY
  ) {
    return REVENUECAT_TEST_API_KEY;
  }

  if (Platform.OS === "ios") {
    return REVENUECAT_IOS_API_KEY || REVENUECAT_TEST_API_KEY || null;
  }

  if (Platform.OS === "android") {
    return REVENUECAT_ANDROID_API_KEY || REVENUECAT_TEST_API_KEY || null;
  }

  return REVENUECAT_TEST_API_KEY || null;
}

export function initializeRevenueCat(): boolean {
  if (isConfigured) return true;

  if (!SUBSCRIPTIONS_ENABLED) {
    console.log("[RevenueCat] Subscriptions disabled by feature flag");
    return false;
  }

  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn("[RevenueCat] No API key available — billing disabled");
    return false;
  }

  if (__DEV__) {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  }

  Purchases.configure({ apiKey });
  isConfigured = true;
  console.log("[RevenueCat] Configured successfully");
  return true;
}

export function isRevenueCatConfigured() {
  return isConfigured;
}

export async function presentPaywall(): Promise<boolean> {
  if (!SUBSCRIPTIONS_ENABLED) return true;
  if (!isConfigured) return false;

  try {
    const paywallResult: PAYWALL_RESULT =
      await RevenueCatUI.presentPaywall();

    switch (paywallResult) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return true;
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      case PAYWALL_RESULT.CANCELLED:
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export type PurchaseError = {
  userCancelled: boolean;
  message: string;
};

function parsePurchaseError(err: any): PurchaseError {
  if (err?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
    return { userCancelled: true, message: "Purchase was cancelled." };
  }
  return {
    userCancelled: false,
    message: err?.message || "An error occurred during purchase.",
  };
}

function useSubscriptionContext() {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      if (!isConfigured) return null;
      return Purchases.getCustomerInfo();
    },
    enabled: isConfigured,
    staleTime: 60 * 1000,
    retry: 2,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      if (!isConfigured) return null;
      return Purchases.getOfferings();
    },
    enabled: isConfigured,
    staleTime: 300 * 1000,
    retry: 2,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: any) => {
      const { customerInfo } =
        await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return Purchases.restorePurchases();
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements?.active?.[
      REVENUECAT_ENTITLEMENT_IDENTIFIER
    ] !== undefined;

  const annualPackage = offeringsQuery.data?.current?.availablePackages?.find(
    (pkg: any) =>
      pkg.packageType === "ANNUAL" ||
      pkg.product?.subscriptionPeriod === "P1Y",
  );
  const fallbackPackage =
    offeringsQuery.data?.current?.availablePackages?.[0] ?? null;
  const selectedPackage = annualPackage ?? fallbackPackage;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    selectedPackage,
    isSubscribed,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    isConfigured,
    purchase: purchaseMutation.mutateAsync,
    purchaseError: purchaseMutation.error
      ? parsePurchaseError(purchaseMutation.error)
      : null,
    restore: restoreMutation.mutateAsync,
    restoreError: restoreMutation.error?.message ?? null,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    resetPurchaseError: purchaseMutation.reset,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useSubscriptionContext();
  const queryClient = useQueryClient();
  const listenerAdded = useRef(false);

  useEffect(() => {
    if (!isConfigured || listenerAdded.current) return;
    listenerAdded.current = true;

    Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
      queryClient.setQueryData(["revenuecat", "customer-info"], info);
    });

    if (Platform.OS === "ios") {
      Purchases.addShouldPurchasePromoProductListener(
        async (deferredPurchase) => {
          try {
            await deferredPurchase();
          } catch {}
        },
      );
    }
  }, [queryClient]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider",
    );
  }
  if (!SUBSCRIPTIONS_ENABLED) {
    return { ...ctx, isSubscribed: true, isLoading: false };
  }
  return ctx;
}
