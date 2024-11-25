import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { List } from "./list";
import { AWS } from "./aws";

export const Logs = (
  <Route>
    <Route path="/" component={List} />
    <Route path="aws" component={AWS} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
