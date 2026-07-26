/** Default (non-AI) follow-up message template, used when the caller doesn't supply their own text. */
export function buildDefaultFollowUpMessage(params: { position?: string; companyName?: string }): string {
  const role = params.position ?? 'this role';
  const company = params.companyName ? ` at ${params.companyName}` : '';

  return `Hi, I wanted to follow up on my application for ${role}${company}. I remain very interested in the opportunity and would love to hear about next steps. Thank you for your time!`;
}
