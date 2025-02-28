import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { List } from "./list";
import { AWSNext } from "./aws/next";
import { useApi } from "../../context";
import { createStageContext } from "../context";
import { GatedOverlayWarning } from "../../app/warning";

export const Logs = (
  <Route>
    <Route path="/" component={List} />
    <Route
      path="aws-next"
      component={() => {
        const api = useApi();
        const ctx = createStageContext();
        return (
          <>
            {api.isGated && !ctx.connected && <GatedOverlayWarning stage />}
            <AWSNext />
          </>
        );
      }}
    />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
