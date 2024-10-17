export const storage = new sst.aws.Bucket("Storage", {
  access: "public",
});

new aws.s3.BucketLifecycleConfigurationV2("StorageLifecycle", {
  bucket: storage.name,
  rules: [
    {
      id: "daily",
      status: "Enabled",
      filter: {
        prefix: "temporary/daily/",
      },
      expiration: {
        days: 1,
      },
    },
    {
      id: "weekly",
      status: "Enabled",
      filter: {
        prefix: "temporary/daily/",
      },
      expiration: {
        days: 7,
      },
    },
    {
      id: "monthly",
      status: "Enabled",
      filter: {
        prefix: "temporary/monthly/",
      },
      expiration: {
        days: 7,
      },
    },
  ],
});
