import { route } from "@/server/api";
import { getDashboard } from "@/server/metrics";
import { buildAlerts, getActionCentre } from "@/server/insights";
import { getCompany } from "@/server/settings";

export const GET = route({}, async ({ user }) => {
  const [dashboard, alerts, action, company] = await Promise.all([getDashboard(), buildAlerts(), getActionCentre(), getCompany()]);
  return { dashboard, alerts, action, user: { name: user.name }, company: { name: company.name, currency: company.currency } };
});
