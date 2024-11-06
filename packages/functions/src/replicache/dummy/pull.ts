// @ts-nocheck
import { withActor, useActor } from "@console/core/actor";
import { NotPublic } from "../../api";
import {
  ApiHandler,
  useHeader,
  useJsonBody,
  useQueryParam,
} from "sst/node/api";
import { PatchOperation, PullRequest, PullResponseV1 } from "replicache";
import { sessions } from "../../sessions";
import { generateData } from "./data";
import { createHash, subtle } from "crypto";
import { Resource } from "@console/core/app/resource";

export const handler = ApiHandler(async () => {
  const session = sessions.use();
  const workspaceID = useHeader("x-sst-workspace");

  return withActor(
    !workspaceID
      ? session
      : {
          type: "user",
          properties: {
            workspaceID,
            userID: "dummy-user",
          },
        },
    () => {
      const actor = useActor();
      NotPublic();

      const req: PullRequest = useJsonBody();
      const cookie = (req.cookie || {
        hash: "",
        order: 0,
      }) as {
        hash: string;
        order: number;
      };
      const patch: PatchOperation[] = [];
      console.log("request", req);

      const response: PullResponseV1 = {
        patch: [],
        cookie: cookie,
        lastMutationIDChanges: {},
      };

      patch.push({
        op: "clear",
      });
      patch.push({
        op: "put",
        key: "/init",
        value: true,
      });

      const data = generateData(useQueryParam("dummy") || "empty");
      const keys = {
        run: (item: any) => [item._type, item.stageID, item.id],
        appRepo: (item: any) => [item._type, item.appID, item.id],
        runConfig: (item: any) => [item._type, item.appID, item.id],
        resource: (item: any) => [item._type, item.stageID, item.id],
        stateUpdate: (item: any) => [item._type, item.stageID, item.id],
        stateResource: (item: any) => [item._type, item.stageID, item.id],
        stateEvent: (item: any) => [
          item._type,
          item.stageID,
          item.updateID,
          item.id,
        ],
        issue: (issue: any) => [issue._type, issue.stageID, issue.id],
        issueCount: (issueCount: any) => [
          issueCount._type,
          issueCount.group,
          issueCount.id,
        ],
        warning: (warning: any) => [
          warning._type,
          warning.stageID,
          warning.type,
          warning.id,
        ],
        default: (item: any) => [
          item._type,
          "id" in item ? item.id : undefined,
        ],
      };
      for (const item of data) {
        const { _type, ...value } = item;
        if (
          actor.type === "account" &&
          !["workspace", "user", "dummyConfig"].includes(_type)
        )
          continue;
        patch.push({
          op: "put",
          key:
            // @ts-expect-error
            "/" + (keys[_type] || keys.default)(item).filter(Boolean).join("/"),
          value: value as any,
        });
      }
      const hash = createHash("sha256")
        .update(JSON.stringify(patch))
        .digest("hex");

      if (cookie.hash !== hash) {
        response.patch = patch;
        response.cookie = {
          hash,
          order: (cookie.order || 0) + 1,
        };
      }

      return {
        statusCode: 200,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(response),
      };
    },
  );
});
