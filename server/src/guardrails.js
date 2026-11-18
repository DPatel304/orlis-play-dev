/* Guardrails for creators' games on a family's TV: every rule is a switch or a number here, so a rule can be
   loosened later by changing one line - and each one has a test that shows what it holds back.
   Start strict (this file), loosen as trust grows.

   tvConfirmPublish   the laptop tool (Claude) can only ASK to publish; a grown-up presses Publish on the TV
   askMinutes         how long that question waits on the TV
   testsPerMinute     how many times a family may put a game on the TV, a minute
   asksPerHour        how many times a family may ask to publish, an hour */
export const GUARDRAILS = {
  tvConfirmPublish: true,
  askMinutes: 15,
  testsPerMinute: 6,
  asksPerHour: 10
};
/* the sign-in the laptop tool uses (pair.js) - it can ask, never confirm */
export const TOOL_DEVICE = 'Orlis tool';
