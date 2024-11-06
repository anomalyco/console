const PRODUCTION = "console.sst.dev";
const DEV = "dev.console.sst.dev";

export const { zone, domain } = (() => {
  if ($app.stage === "production")
    return {
      zone: new aws.route53.Zone("Zone", {
        name: PRODUCTION,
      }),
      domain: PRODUCTION,
    };

  if ($app.stage === "dev")
    return {
      zone: new aws.route53.Zone(
        "Zone",
        {
          name: DEV,
        },
        {
          import: "Z04733193GHYW3SIO6DKT",
          ignoreChanges: ["*"],
        },
      ),
      domain: DEV,
    };

  return {
    zone: aws.route53.Zone.get("Zone", "Z04733193GHYW3SIO6DKT"),
    domain: `${$app.stage}.${DEV}`,
  };
})();
