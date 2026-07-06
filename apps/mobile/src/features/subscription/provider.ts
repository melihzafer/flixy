import type { PlanId } from '../entitlements/types';

export type PurchasablePlan = Exclude<PlanId, 'free' | 'platinum'>;

export interface SubscriptionProvider {
  purchase(plan: PurchasablePlan): Promise<void>;
  restore(): Promise<void>;
}

export const unavailableSubscriptionProvider: SubscriptionProvider = {
  purchase: async () => {
    throw new Error('Purchases are not configured yet.');
  },
  restore: async () => {
    throw new Error('Purchases are not configured yet.');
  },
};
