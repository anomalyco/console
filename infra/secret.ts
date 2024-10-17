export const secret = {
  SlackClientID: new sst.Secret("SlackClientID"),
  SlackClientSecret: new sst.Secret("SlackClientSecret"),
  GithubAppID: new sst.Secret("GithubAppID"),
  GithubPrivateKey: new sst.Secret("GithubPrivateKey"),
  BotpoisonSecretKey: new sst.Secret("BotpoisonSecretKey"),
};

export const allSecrets = [...Object.values(secret)];
