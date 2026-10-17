export const vpc = ["dev", "production"].includes($app.stage)
  ? new sst.aws.Vpc("VPC", {
      bastion: true,
      nat: "managed",
      transform: {
        bastionSecurityGroup(args) {
          // Keep production management on its private/SSM path, not public SSH.
          if ($app.stage === "production") args.ingress = [];
        },
      },
    })
  : sst.aws.Vpc.get("VPC", "vpc-069d2d529d3288945");
