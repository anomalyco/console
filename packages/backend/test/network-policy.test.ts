import { expect, test } from "bun:test";

test("production bastion configuration does not restore the public SSH default", async () => {
  type SecurityGroup = {
    ingress: {
      protocol: string;
      fromPort: number;
      toPort: number;
      cidrBlocks: string[];
    }[];
  };
  let configure: ((group: SecurityGroup) => void) | undefined;
  class Vpc {
    constructor(
      _name: string,
      args: { transform: { bastionSecurityGroup(group: SecurityGroup): void } },
    ) {
      configure = args.transform.bastionSecurityGroup;
    }
  }
  // Evaluate only this small configuration module with a constructor fixture;
  // no SST/Pulumi provider or cloud operation runs in the test.
  const source = await Bun.file(
    new URL("../../../infra/network.ts", import.meta.url),
  ).text();
  const load = new Function(
    "$app",
    "sst",
    source.replace("export const vpc =", "return"),
  );
  load({ stage: "production" }, { aws: { Vpc } });
  const group = {
    ingress: [
      { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
    ],
  };
  expect(!!configure).toBe(true);
  configure!(group);
  expect(group.ingress).toEqual([]);
});
