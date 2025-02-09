import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { List } from "./list";
import { AWS } from "./aws";
import { AWSNext } from "./aws/next";
import { useApi, useWorkspace } from "../../context";
import { createStageContext } from "../context";
import { Show } from "solid-js";
import { Fullscreen } from "@console/web/ui/layout";
import { GatedWarning } from "../../app/warning";

export const Logs = (
  <Route
    component={(props) => {
      const api = useApi();
      const ctx = createStageContext();
      const workspace = useWorkspace();
      return (
        <Show
          when={workspace().timeGated == null || ctx.connected || api.isFree}
          fallback={
            <>
              <Fullscreen inset="header-tabs">
                <GatedWarning />
              </Fullscreen>
            </>
          }
        >
          {props.children}
        </Show>
      );
    }}
  >
    <Route path="/" component={List} />
    <Route path="aws" component={AWS} />
    <Route path="aws-next" component={AWSNext} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
