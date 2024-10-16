const mysql =
  $app.stage === "production"
    ? new planetscale.Database(
        "Database",
        {
          organization: "sst",
        },
        {
          import: "sst,sst",
        },
      )
    : planetscale.Database.get("Database", "sst,sst");

const branch = new planetscale.Branch("DatabaseBranch", {
  database: mysql.name,
  organization: mysql.organization,
  name: $app.stage,
  parentBranch: "production",
  production: $app.stage === "production",
});

const password = new planetscale.Password("DatabasePassword", {
  database: mysql.name,
  organization: mysql.organization,
  branch: branch.name,
  role: "admin",
  name: `${$app.name}-${$app.stage}-credentials`,
});

export const database = new sst.Linkable("Database", {
  properties: {
    username: password.username,
    host: branch.mysqlAddress,
    password: password.plaintext,
    database: password.database,
    port: 3306,
  },
});
