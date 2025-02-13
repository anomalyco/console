export const regions = ["production"].includes($app.stage)
  ? await aws.getRegions().then((r) => r.names)
  : ["us-east-1"];

const providers = {} as Record<string, aws.Provider | undefined>;
for (const region of regions) {
  if (region === "us-east-1") {
    providers[region] = undefined;
  } else {
    providers[region] = new aws.Provider("Aws_" + region, {
      region: region as any,
    });
  }
}

export function multiregion<T>(
  cb: (region: string, provider?: aws.Provider) => T,
): Record<string, T> {
  const result = {} as Record<string, T>;
  for (const [region, provider] of Object.entries(providers)) {
    result[region] = cb(region, provider);
  }
  return result;
}
