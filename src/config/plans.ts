export interface PlanConfig {
  planId: string;
  name: string;
  amount: number; // KRW
  credits: number;
  durationDays?: number;
}

export const PLAN_PRICES: Record<string, PlanConfig> = {
  plan_cbt_single: {
    planId: 'plan_cbt_single',
    name: 'CBT 1회 응시권',
    amount: 4900,
    credits: 1,
  },
  plan_cbt_pass: {
    planId: 'plan_cbt_pass',
    name: 'CBT 5회 패키지 + AI 롤플레잉 무제한',
    amount: 19900,
    credits: 5,
    durationDays: 30,
  },
  plan_unlimited_pro: {
    planId: 'plan_unlimited_pro',
    name: '30일 무제한 모의평가 & 집중 피드백',
    amount: 29000,
    credits: 999,
    durationDays: 30,
  },
};
