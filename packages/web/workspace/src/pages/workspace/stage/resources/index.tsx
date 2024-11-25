import { NavigationAction, useCommandBar } from "$/pages/workspace/command-bar";
import { useStageContext } from "$/pages/workspace/stage/context";
import { Route, useNavigate } from "@solidjs/router";
import { IconSubRight } from "$/ui/icons/custom";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";

export const Resources = (
  <Route
    component={(props) => {
      const ctx = useStageContext();
      const bar = useCommandBar();
      const nav = useNavigate();

      bar.register("resources", async () => {
        return [
          NavigationAction({
            icon: IconSubRight,
            path: "./updates",
            category: ctx.stage.name,
            title: "History",
            nav,
          }),
        ];
      });
      return props.children;
    }}
  >
    <Route path="" component={List} />
    <Route path=":urn" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
