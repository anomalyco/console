import { database } from "./planetscale";
import { allSecrets } from "./secret";
import { domain } from "./dns";

const opencontrol = new sst.aws.OpenControl("OpenControl", {
  server: {
    handler: "packages/backend/src/function/opencontrol/server.handler",
    link: [database, ...allSecrets],
    transform: {
      role: (args) => {
        args.managedPolicyArns = $output(args.managedPolicyArns).apply((v) => [
          ...(v ?? []),
          "arn:aws:iam::aws:policy/ReadOnlyAccess",
        ]);
      },
    },
  },
});

new sst.aws.Router("OpenControlRouter", {
  routes: {
    "/*": opencontrol.url,
  },
  domain: "opencontrol." + domain,
});
