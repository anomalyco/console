import { NavigationAction, useCommandBar } from "$/pages/workspace/command-bar";
import { useStageContext } from "$/pages/workspace/stage/context";
import { Route, Routes, useNavigate } from "@solidjs/router";
import { IconSubRight } from "$/ui/icons/custom";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";

export function Resources() {
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
  return (
    <Routes>
      <Route path="" element={<List />} />
      <Route path=":urn" component={Detail} />
      <Route path="*" element={<NotFound inset="header-tabs" />} />
    </Routes>
  );
}
