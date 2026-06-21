import { isNative, isIOS, isAndroid } from './capacitor';

let purchasesModule: any = null;

async function getPurchases() {
  if (!purchasesModule) {
    purchasesModule = await import('@revenuecat/purchases-capacitor');
  }
  return purchasesModule.Purchases;
}

export async function initRevenueCat(userId?: string) {
  if (!isNative) return;

  const Purchases = await getPurchases();

  const apiKey = isIOS
    ? import.meta.env.VITE_REVENUECAT_IOS_KEY
    : import.meta.env.VITE_REVENUECAT_ANDROID_KEY;

  if (!apiKey) {
    console.warn('[RevenueCat] No API key for platform:', isIOS ? 'iOS' : 'Android');
    return;
  }

  await Purchases.configure({
    apiKey,
    appUserID: userId || null,
  });
}

export async function getOfferings() {
  if (!isNative) return null;
  const Purchases = await getPurchases();
  const { offerings } = await Purchases.getOfferings();
  return offerings;
}

export async function purchasePackage(packageToPurchase: any) {
  if (!isNative) return null;
  const Purchases = await getPurchases();
  const result = await Purchases.purchasePackage({ aPackage: packageToPurchase });
  return result;
}

export async function restorePurchases() {
  if (!isNative) return null;
  const Purchases = await getPurchases();
  const { customerInfo } = await Purchases.restorePurchases();
  return customerInfo;
}

export async function getCustomerInfo() {
  if (!isNative) return null;
  const Purchases = await getPurchases();
  const { customerInfo } = await Purchases.getCustomerInfo();
  return customerInfo;
}

export async function checkProEntitlement(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const info = await getCustomerInfo();
    return info?.entitlements?.active?.['pro'] !== undefined;
  } catch {
    return false;
  }
}

export async function loginRevenueCat(userId: string) {
  if (!isNative) return;
  const Purchases = await getPurchases();
  await Purchases.logIn({ appUserID: userId });
}

export async function logoutRevenueCat() {
  if (!isNative) return;
  const Purchases = await getPurchases();
  await Purchases.logOut();
}
