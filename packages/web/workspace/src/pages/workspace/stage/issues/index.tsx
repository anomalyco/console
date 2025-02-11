import { Route } from "@solidjs/router";
import { List } from "./list";
import { Detail } from "./detail";
import { NotFound } from "../../../not-found";
import { useApi } from "../../context";
import { createStageContext } from "../context";
import { GatedOverlayWarning } from "../../app/warning";

export const Issues = (
  <Route
    component={(props) => {
      const api = useApi();
      const ctx = createStageContext();
      return (
        <>
          {api.isGated && !ctx.connected && <GatedOverlayWarning stage />}
          {props.children}
        </>
      );
    }}
  >
    <Route path="" component={List} />
    <Route path=":issueID" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
