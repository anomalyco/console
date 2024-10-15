export const secret = {
  SlackClientID: new sst.Secret("SlackClientID"),
  SlackClientSecret: new sst.Secret("SlackClientSecret"),
  BotpoisonSecretKey: new sst.Secret("BotpoisonSecretKey"),
};

export const allSecrets = [...Object.values(secret)];
