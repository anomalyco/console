import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { useApi } from "../../context";
import { createStageContext } from "../context";
import { Show } from "solid-js";
import { Fullscreen } from "@console/web/ui/layout";
import { GatedWarning } from "../../app/warning";

export const Updates = (
  <Route>
    <Route
      path=""
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
            <List />
          </Show>
        );
      }}
    />
    <Route path=":updateID" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
