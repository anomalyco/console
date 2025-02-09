import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { useApi, useWorkspace } from "../../context";
import { createStageContext } from "../context";
import { Show } from "solid-js";
import { Fullscreen } from "@console/web/ui/layout";
import { GatedWarning } from "../../app/warning";

export const Updates = (
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
    <Route path="" component={List} />
    <Route path=":updateID" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
