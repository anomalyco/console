import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { useApi } from "../../context";
import { createStageContext } from "../context";
import { Show } from "solid-js";
import { GatedOverlayWarning } from "../../app/warning";

export const Updates = (
  <Route>
    <Route
      path=""
      component={() => {
        const api = useApi();
        const ctx = createStageContext();
        return (
          <>
            {api.isGated && !ctx.connected && <GatedOverlayWarning stage />}
            <List />
          </>
        );
      }}
    />
    <Route path=":updateID" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
