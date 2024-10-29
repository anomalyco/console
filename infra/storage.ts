export const storage = new sst.aws.Bucket("Storage");

new aws.s3.BucketOwnershipControls("ownership-controls", {
  bucket: storage.name,
  rule: {
    objectOwnership: "ObjectWriter",
  },
});

export const storageAccess = new aws.s3.BucketPublicAccessBlock(
  "StorageAccess",
  {
    bucket: storage.name,
    blockPublicAcls: false,
    blockPublicPolicy: false,
    ignorePublicAcls: false,
    restrictPublicBuckets: false,
  },
);

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
        days: 30,
      },
    },
  ],
});
