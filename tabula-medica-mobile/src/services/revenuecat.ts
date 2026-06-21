import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL, PurchasesOffering, CustomerInfo } from 'react-native-purchases';

const API_KEY = process.env.REVENUECAT_API_KEY || 'test_vVJperZjIBHfGWkljapzFFQnDFu';

export async function initRevenueCat(): Promise<void> {
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

  if (Platform.OS === 'ios') {
    await Purchases.configure({ apiKey: API_KEY });
  } else if (Platform.OS === 'android') {
    await Purchases.configure({ apiKey: API_KEY });
  }
}

export async function identifyUser(userId: string): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.logIn(userId);
  return customerInfo;
}

export async function logoutUser(): Promise<CustomerInfo> {
  return Purchases.logOut();
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

export function isProSubscriber(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active['pro'] !== undefined;
}

export function isFamilySubscriber(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active['family'] !== undefined;
}

export function hasActiveSubscription(customerInfo: CustomerInfo): boolean {
  return isProSubscriber(customerInfo) || isFamilySubscriber(customerInfo);
}

export async function purchasePackage(packageToPurchase: any): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function getSubscriptionStatus(): Promise<{
  isActive: boolean;
  tier: 'free' | 'pro' | 'family';
  expirationDate: string | null;
  willRenew: boolean;
}> {
  const customerInfo = await getCustomerInfo();

  if (isFamilySubscriber(customerInfo)) {
    const entitlement = customerInfo.entitlements.active['family'];
    return {
      isActive: true,
      tier: 'family',
      expirationDate: entitlement.expirationDate,
      willRenew: !entitlement.willRenew === false,
    };
  }

  if (isProSubscriber(customerInfo)) {
    const entitlement = customerInfo.entitlements.active['pro'];
    return {
      isActive: true,
      tier: 'pro',
      expirationDate: entitlement.expirationDate,
      willRenew: !entitlement.willRenew === false,
    };
  }

  return {
    isActive: false,
    tier: 'free',
    expirationDate: null,
    willRenew: false,
  };
}
