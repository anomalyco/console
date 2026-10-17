// Customer rules forward through the integration role. They never publish
// internal Console events, even when their detail contains actor metadata.
export function eventBusPolicy(arn: string, stage: string) {
  const account = arn.split(":")[4]!;
  const suffix = stage === "production" ? "" : `-${stage}`;
  return {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "ConsoleEvents",
        Effect: "Allow",
        Principal: { AWS: `arn:aws:iam::${account}:root` },
        Action: "events:PutEvents",
        Resource: arn,
      },
      {
        Sid: "CustomerForwardedEvents",
        Effect: "Allow",
        Principal: { AWS: "*" },
        Action: "events:PutEvents",
        Resource: arn,
        Condition: {
          ArnLike: {
            "aws:PrincipalArn": `arn:aws:iam::*:role/SSTConsolePublisher${suffix}`,
          },
          StringEquals: {
            "events:source": ["aws.s3", "aws.codebuild", "sst.runner"],
          },
          Bool: { "events:eventBusInvocation": "true" },
        },
      },
    ],
  };
}
