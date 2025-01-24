export const secret = {
  StripeSecretKey: new sst.Secret("StripeSecretKey"),
  StripeWebhookSigningSecret: new sst.Secret("StripeWebhookSigningSecret"),
  StripeInvocationsPriceID: new sst.Secret(
    "StripeInvocationsPriceID",
    $app.stage === "production"
      ? "price_1NlZmAEAHP8a0ogpglxmSac1"
      : "price_1NgB4oEAHP8a0ogpxqUXHKee"
  ),
  StripeResourcesPriceID: new sst.Secret(
    "StripeResourcesPriceID",
    $app.stage === "production"
      ? "price_1QhwLAEAHP8a0ogpjRV91Yl8"
      : "price_1Qi4QzEAHP8a0ogpDvPDu8Bm"
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
