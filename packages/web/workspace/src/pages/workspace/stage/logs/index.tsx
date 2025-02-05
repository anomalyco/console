import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { List } from "./list";
import { AWS } from "./aws";
import { AWSNext } from "./aws/next";

export const Logs = (
  <Route>
    <Route path="/" component={List} />
    <Route path="aws" component={AWS} />
    <Route path="aws-next" component={AWSNext} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
