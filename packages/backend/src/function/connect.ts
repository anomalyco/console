import { fetch } from "undici";
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from "aws-lambda";
import {
  CloudFormationClient,
  DescribeStackResourceCommand,
} from "@aws-sdk/client-cloudformation";
import { AWS } from "@console/core/aws/index";
import { withActor } from "@console/core/actor";
import { Replicache } from "@console/core/replicache/index";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";

// Anyone can invoke this function directly, so only act on requests that
// CloudFormation is currently processing inside the account being connected.
async function verify(
  event: CloudFormationCustomResourceEvent,
  credentials: NonNullable<Awaited<ReturnType<typeof AWS.assumeRole>>>,
) {
  const match = event.StackId.match(
    /^arn:aws:cloudformation:([a-z0-9-]+):(\d{12}):stack\/[^/]+\/[^/]+$/,
  );
  if (!match) return false;
  const [, region, accountID] = match;
  if (accountID !== event.ResourceProperties.accountID) return false;
  const client = new CloudFormationClient({ region, credentials });
  try {
    const result = await client.send(
      new DescribeStackResourceCommand({
        StackName: event.StackId,
        LogicalResourceId: event.LogicalResourceId,
      }),
    );
    const detail = result.StackResourceDetail;
    if (detail?.ResourceType !== "Custom::SSTConnect") return false;
    const expected =
      event.RequestType === "Create" ? "CREATE_IN_PROGRESS" : "DELETE_IN_PROGRESS";
    return detail.ResourceStatus === expected;
  } catch (ex) {
    console.error(ex);
    return false;
  } finally {
    client.destroy();
  }
}

function isValidInput(event: CloudFormationCustomResourceEvent) {
  return (
    /^\d{12}$/.test(event.ResourceProperties.accountID ?? "") &&
    /^[A-Za-z0-9_-]{1,64}$/.test(event.ResourceProperties.workspaceID ?? "")
  );
}

function isResponseURL(input: string) {
  const url = URL.canParse(input) ? new URL(input) : undefined;
  return (
    url?.protocol === "https:" &&
    /^cloudformation-custom-resource-response-[a-z0-9]+\.s3([.-][a-z0-9-]+)?\.amazonaws\.com$/.test(
      url.hostname,
    )
  );
}

export async function handler(event: CloudFormationCustomResourceEvent) {
  console.log(event.RequestType, event.ResourceProperties.accountID);
  if (!isResponseURL(event.ResponseURL)) {
    console.error("invalid response url", event.ResponseURL);
    return;
  }
  let status: CloudFormationCustomResourceResponse["Status"] = "SUCCESS";
  if (event.RequestType === "Create") {
    try {
      if (!isValidInput(event)) throw new Error("invalid input");
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: event.ResourceProperties.workspaceID,
          },
        },
        async () => {
          const credentials = await AWS.assumeRole(
            event.ResourceProperties.accountID,
          );
          if (credentials && (await verify(event, credentials))) {
            await AWS.Account.create({
              accountID: event.ResourceProperties.accountID,
            });
            await Replicache.poke();
            status = "SUCCESS";
          } else {
            status = "FAILED";
          }
        },
      );
    } catch (ex) {
      console.error(ex);
      status = "FAILED";
    }
  }

  if (event.RequestType === "Delete" && isValidInput(event)) {
    try {
      await withActor(
        {
          type: "system",
          properties: {
            workspaceID: event.ResourceProperties.workspaceID,
          },
        },
        async () => {
          const account = await AWS.Account.fromAccountID(
            event.ResourceProperties.accountID,
          );
          if (!account) return;

          const credentials = await AWS.assumeRole(
            event.ResourceProperties.accountID,
          );
          if (!credentials || !(await verify(event, credentials))) {
            console.error("unverified delete request", event.StackId);
            return;
          }

          await bus.publish(Resource.Bus, AWS.Account.Events.Removed, {
            awsAccountID: account.id,
          });
        },
      );
    } catch (ex) {
      console.error(ex);
    }
  }

  const json: CloudFormationCustomResourceResponse = {
    Status: status,
    Reason: "",
    StackId: event.StackId,
    RequestId: event.RequestId,
    PhysicalResourceId: "none",
    LogicalResourceId: event.LogicalResourceId,
  };

  await fetch(event.ResponseURL, {
    method: "PUT",
    body: JSON.stringify(json),
  });
}
