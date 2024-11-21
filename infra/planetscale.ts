const mysql = planetscale.Database.get("Database", "sst,sst");

const branch =
  $app.stage === "production"
    ? planetscale.Branch.get("DatabaseBranch", "sst,sst,production")
    : new planetscale.Branch(
        "DatabaseBranch",
        {
          database: mysql.name,
          organization: mysql.organization,
          name: $app.stage,
          parentBranch: "production",
          production: $app.stage === "production",
        },
        {},
      );

const password = new planetscale.Password("DatabasePassword", {
  database: mysql.name,
  organization: mysql.organization,
  branch: branch.name,
  role: "admin",
  name: `${$app.name}-${$app.stage}-password`,
});

export const database = new sst.Linkable("Database", {
  properties: {
    host: branch.mysqlAddress,
    username: password.username,
    database: password.database,
    password: password.plaintext,
    port: 3306,
  },
});
