export const bus = new sst.aws.Bus("Bus");

new aws.cloudwatch.EventBusPolicy("BusPolicy", {
  eventBusName: bus.name,
  policy: $jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "AllowEvents",
        Effect: "Allow",
        Principal: {
          AWS: "*",
          Service: "s3.amazonaws.com",
        },
        Action: "events:PutEvents",
        Resource: bus.nodes.bus.arn,
      },
    ],
  }),
});
