import { fetch } from "undici";
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
} from "aws-lambda";
import { AWS } from "@console/core/aws";
import { withActor } from "@console/core/actor";
import { Replicache } from "@console/core/replicache";
import { bus } from "sst/aws/bus";
import { Resource } from "sst";

export async function handler(event: CloudFormationCustomResourceEvent) {
  console.log(event);
  let status: CloudFormationCustomResourceResponse["Status"] = "SUCCESS";
  if (event.RequestType === "Create") {
    try {
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
          if (credentials) {
            await AWS.Account.create({
              accountID: event.ResourceProperties.accountID,
            });
            await Replicache.poke();
            console.log(credentials);
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

  if (event.RequestType === "Delete") {
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

        await bus.publish(Resource.Bus, AWS.Account.Events.Removed, {
          awsAccountID: account.id,
        });
      },
    );
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
