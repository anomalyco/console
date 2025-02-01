import { Route } from "@solidjs/router";
import { List } from "./list";
import { Detail } from "./detail";
import { NotFound } from "../../../not-found";

export const Issues = (
  <Route>
    <Route path="" component={List} />
    <Route path=":issueID" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
