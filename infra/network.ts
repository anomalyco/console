export const vpc = ["dev", "production"].includes($app.stage)
  ? new sst.aws.Vpc("VPC", {
      bastion: true,
      nat: "managed",
    })
  : sst.aws.Vpc.get("VPC", "vpc-069d2d529d3288945");
