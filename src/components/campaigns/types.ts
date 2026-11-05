export type Variant = { id?: string; label: string; subject: string; body: string; enabled: boolean };
export type Step = { id?: string; order?: number; delayDays: number; variants: Variant[] };
export type CampaignFull = {
  id: string; name: string; status: string; clientId: string | null; client: { name: string } | null;
  timezone: string; days: number[]; startTime: string; endTime: string; dailyLimit: number;
  stopOnReply: boolean; stopOnAutoReply: boolean; stopForCompany: boolean; openTracking: boolean; linkTracking: boolean;
  textOnly: boolean; unsubscribeLink: boolean; prioritizeNewLeads: boolean;
  steps: Step[]; accountIds: string[]; _count: { leads: number };
};
