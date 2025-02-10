import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { List } from "./list";
import { AWS } from "./aws";
import { AWSNext } from "./aws/next";
import { useApi } from "../../context";
import { createStageContext } from "../context";
import { Show } from "solid-js";
import { Fullscreen } from "@console/web/ui/layout";
import { GatedWarning } from "../../app/warning";

export const Logs = (
  <Route>
    <Route path="/" component={List} />
    <Route path="aws" component={AWS} />
    <Route
      path="aws-next"
      component={() => {
        const api = useApi();
        const ctx = createStageContext();
        return (
          <Show
            when={!api.isGated || ctx.connected}
            fallback={
              <>
                <Fullscreen inset="header-tabs">
                  <GatedWarning />
                </Fullscreen>
              </>
            }
          >
            <AWSNext />
          </Show>
        );
      }}
    />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
