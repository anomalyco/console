import { Route } from "@solidjs/router";
import { List } from "./list";
import { Detail } from "./detail";
import { NotFound } from "../../../not-found";
import { useApi } from "../../context";
import { createStageContext } from "../context";
import { Show } from "solid-js";
import { Fullscreen } from "@console/web/ui/layout";
import { GatedWarning } from "../../app/warning";

export const Issues = (
  <Route
    component={(props) => {
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
          {props.children}
        </Show>
      );
    }}
  >
    <Route path="" component={List} />
    <Route path=":issueID" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
