const alerts = new sst.aws.SnsTopic("Alerts");

new aws.sns.TopicSubscription("AlertsSubscription", {
  topic: alerts.arn,
  protocol: "email",
  endpoint:
    "alert-sst-aaaanfxph6mglwqxacgpdhpbrq@anomaly-innovations.slack.com",
});

// Alarm for high concurrent Lambda executions
new aws.cloudwatch.MetricAlarm("AlarmLambda", {
  comparisonOperator: "GreaterThanThreshold",
  evaluationPeriods: 1,
  metricName: "ConcurrentExecutions",
  namespace: "AWS/Lambda",
  period: 30,
  statistic: "Maximum",
  threshold: 100,
  alarmDescription: "Alarm when concurrent Lambda executions exceed 100",
  alarmActions: [alerts.arn],
  insufficientDataActions: [],
});

export {};
