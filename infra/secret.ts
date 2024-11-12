export const secret = {
  StripeSecretKey: new sst.Secret("StripeSecretKey"),
  StripeWebhookSigningSecret: new sst.Secret("StripeWebhookSigningSecret"),
  StripePriceID: new sst.Secret("StripePriceID"),
  SlackClientID: new sst.Secret("SlackClientID"),
  SlackClientSecret: new sst.Secret("SlackClientSecret"),
  GithubAppID: new sst.Secret("GithubAppID"),
  GithubPrivateKey: new sst.Secret("GithubPrivateKey"),
  GithubWebhookSecret: new sst.Secret("GithubWebhookSecret"),
  BotpoisonSecretKey: new sst.Secret("BotpoisonSecretKey"),
};

export const allSecrets = [...Object.values(secret)];

export const assumable = { actions: ["sts:*"], resources: ["*"] };
