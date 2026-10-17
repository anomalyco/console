const mysql = planetscale.Database.get("Database", "anomalyco,sst");

const branch =
  $app.stage === "production"
    ? planetscale.Branch.get("DatabaseBranch", "anomalyco,sst,production")
    : new planetscale.Branch(
        "DatabaseBranch",
        {
          database: mysql.name,
          organization: mysql.organization,
          name: $app.stage,
          parentBranch: "production",
          production: $app.stage === "production",
        },
        { ignoreChanges: ["organization"] },
      );

const password = new planetscale.Password(
  "DatabasePassword",
  {
    database: mysql.name,
    organization: mysql.organization,
    branch: branch.name,
    role: "admin",
    name: `${$app.name}-${$app.stage}-password`,
  },
  { ignoreChanges: ["organization"] },
);

export const database = new sst.Linkable("Database", {
  properties: {
    host: branch.mysqlAddress,
    username: password.username,
    database: password.database,
    password: password.plaintext,
    port: 3306,
  },
});
