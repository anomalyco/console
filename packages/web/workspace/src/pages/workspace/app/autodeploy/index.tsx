import { Route } from "@solidjs/router";
import { AutodeployNotFound } from "./not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { useApi, useWorkspace } from "../../context";
import { GatedWarning } from "../warning";
import { Fullscreen } from "$/ui/layout";
import { Show } from "solid-js";
import { PageHeader } from "../header";

export const Autodeploy = (
  <Route
    component={(props) => {
      const api = useApi();
      const workspace = useWorkspace();
      return (
        <Show
          when={workspace().timeGated == null || api.isFree}
          fallback={
            <>
              <PageHeader />
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
    <Route path="" component={List} />
    <Route path=":runID" component={Detail} />
    <Route path="*" component={AutodeployNotFound} />
  </Route>
);
