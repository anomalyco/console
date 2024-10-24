import { Link, Route, Routes } from "@solidjs/router";
import { Match, Switch } from "solid-js";
import { List } from "./list";
import { Detail } from "./detail";
import { Warning } from "../";
import { NotFound } from "../../../not-found";
import { useWorkspace } from "../../context";
import { useStageContext } from "../context";
import { Fullscreen } from "$/ui/layout";

export function Issues() {
  const ctx = useStageContext();
  const workspace = useWorkspace();
  return (
    <>
      <Switch>
        <Match
          when={workspace().timeGated != null && !ctx.connected && !ctx.isFree}
        >
          <Fullscreen inset="header-tabs">
            <Warning
              title="Update billing details"
              description={
                <>
                  Your usage is above the free tier,{" "}
                  <Link href={`/${workspace().slug}/settings#billing`}>
                    update your billing details
                  </Link>
                  .<br />
                  Note, you can continue using the Console for local stages.
                  <br />
                  Just make sure `sst dev` is running locally.
                </>
              }
            />
          </Fullscreen>
        </Match>
        <Match when={true}>
          <Routes>
            <Route path="" element={<List />} />
            <Route path=":issueID" element={<Detail />} />
            <Route path="*" element={<NotFound inset="header-tabs" />} />
          </Routes>
        </Match>
      </Switch>
    </>
  );
}
