import { Route } from "@solidjs/router";
import { AutodeployNotFound } from "./not-found";
import { Detail } from "./detail";
import { List } from "./list";

export const Autodeploy = (
  <>
    <Route path="" component={List} />
    <Route path=":runID" component={Detail} />
    <Route path="*" component={AutodeployNotFound} />
  </>
);
