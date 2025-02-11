import { Route } from "@solidjs/router";
import { AutodeployNotFound } from "./not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { useApi } from "../../context";
import { GatedOverlayWarning } from "../warning";

export const Autodeploy = (
  <Route
    component={(props) => {
      const api = useApi();
      return (
        <>
          {api.isGated && <GatedOverlayWarning />}
          {props.children}
        </>
      );
    }}
  >
    <Route path="" component={List} />
    <Route path=":runID" component={Detail} />
    <Route path="*" component={AutodeployNotFound} />
  </Route>
);
