const alerts = new sst.aws.SnsTopic("Alerts");
new aws.sns.TopicSubscription("AlertsSubscription", {
  topic: alerts.arn,
  protocol: "email",
  endpoint:
    "alert-sst-aaaanfxph6mglwqxacgpdhpbrq@anomaly-innovations.slack.com",
});
