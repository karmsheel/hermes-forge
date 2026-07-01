import type { Department } from "./types";

/**
 * Auto-categorizes a workflow (process) into a Function / department
 * based on its name or description/brief. Used on first creation.
 */
export function categorizeWorkflow(text: string): Department {
  const t = (text || "").toLowerCase();

  if (!t.trim()) return "Operations";

  // Order matters: more specific first
  if (/(market|campaign|brand|promo|lead gen|advertis)/.test(t)) return "Marketing";
  if (/(customer service|customer success|support|help ?desk|ticket|complaint|escalat)/.test(t)) return "Customer Service";
  if (/(revenue|sale|deal|close|quote|pipeline|upsell|churn)/.test(t)) return "Revenue";
  if (/(manufactur|production|assembly|ship|logistic|supply|factory|quality)/.test(t)) return "Manufacturing";
  if (/(finance|invoice|billing|payment|account|budget|expense|payroll)/.test(t)) return "Finance";
  if (/(hr|recruit|onboard|employee|hiring|talent|performance)/.test(t)) return "HR";
  if (/(sale|lead|prospect|demo|close)/.test(t)) return "Sales";
  if (/(operat|process|workflow|fulfill|order)/.test(t)) return "Operations";

  return "Operations";
}
