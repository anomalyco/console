export const secret = {
  AnthropicKey: new sst.Secret("AnthropicKey"),
  GeminiKey: new sst.Secret("GeminiKey"),
  StripeSecretKey: new sst.Secret("StripeSecretKey"),
  StripeOpenControlSecretKey: new sst.Secret("StripeOpenControlSecretKey"),
  StripeWebhookSigningSecret: new sst.Secret("StripeWebhookSigningSecret"),
  EmailOctopusSecret: new sst.Secret("EmailOctopusSecret", "disabled"),
  StripeInvocationsPriceID: new sst.Secret(
    "StripeInvocationsPriceID",
    $app.stage === "production"
      ? "price_1NlZmAEAHP8a0ogpglxmSac1"
      : "price_1NgB4oEAHP8a0ogpxqUXHKee",
  ),
  StripeResourcesPriceID: new sst.Secret(
    "StripeResourcesPriceID",
    $app.stage === "production"
      ? "price_1QhwLAEAHP8a0ogpjRV91Yl8"
      : "price_1Qi4QzEAHP8a0ogpDvPDu8Bm",
  ),
  StripeCoupon50ID: new sst.Secret(
    "StripeCoupon50ID",
    $app.stage === "production" ? "SQfanxGc" : "O6e5LLnW",
  ),
  StripeCoupon80ID: new sst.Secret(
    "StripeCoupon80ID",
    $app.stage === "production" ? "iZuY8E7x" : "xihoZNwb",
  ),
  SlackClientID: new sst.Secret("SlackClientID"),
  SlackClientSecret: new sst.Secret("SlackClientSecret"),
  GithubAppID: new sst.Secret("GithubAppID"),
  GithubPrivateKey: new sst.Secret("GithubPrivateKey"),
  GithubWebhookSecret: new sst.Secret("GithubWebhookSecret"),
  BotpoisonSecretKey: new sst.Secret("BotpoisonSecretKey"),
};

export const allSecrets = [...Object.values(secret)];

export const assumable = { actions: ["sts:*"], resources: ["*"] };
