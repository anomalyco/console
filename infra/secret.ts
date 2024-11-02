export const secret = {
  SlackClientID: new sst.Secret("SlackClientID"),
  SlackClientSecret: new sst.Secret("SlackClientSecret"),
  GithubAppID: new sst.Secret("GithubAppID"),
  GithubPrivateKey: new sst.Secret("GithubPrivateKey"),
  GithubWebhookSecret: new sst.Secret("GithubWebhookSecret"),
  BotpoisonSecretKey: new sst.Secret("BotpoisonSecretKey"),
};

export const allSecrets = [...Object.values(secret)];

export const assumable = { actions: ["sts:*"], resources: ["*"] };
