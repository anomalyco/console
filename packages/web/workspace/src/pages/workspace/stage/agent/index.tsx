import { Route } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { Chat } from "./chat";

export const Agent = (
  <Route>
    <Route
      path=""
      component={() => {
        return <Chat />;
      }}
    />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
