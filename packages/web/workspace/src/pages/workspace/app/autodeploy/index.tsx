import { Route } from "@solidjs/router";
import { AutodeployNotFound } from "./not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { useApi } from "../../context";
import { GatedWarning } from "../warning";
import { Fullscreen } from "@console/web/ui/layout";
import { Show } from "solid-js";
import { PageHeader } from "../header";

export const Autodeploy = (
  <Route
    component={(props) => {
      const api = useApi();
      return (
        <Show
          when={!api.isGated}
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
