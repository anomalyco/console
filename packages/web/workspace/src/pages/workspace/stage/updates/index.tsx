import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";

export const Updates = (
  <Route>
    <Route path="" component={List} />
    <Route path=":updateID" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
