import { A, Route } from "@solidjs/router";
import { Match, Switch } from "solid-js";
import { List } from "./list";
import { Detail } from "./detail";
import { Warning } from "../";
import { NotFound } from "../../../not-found";
import { useWorkspace } from "../../context";
import { useStageContext } from "../context";
import { Fullscreen } from "$/ui/layout";

export const Issues = (
  <Route
    component={(props) => {
      const ctx = useStageContext();
      const workspace = useWorkspace();
      return (
        <>
          <Switch>
            <Match
              when={
                workspace().timeGated != null && !ctx.connected && !ctx.isFree
              }
            >
              <Fullscreen inset="header-tabs">
                <Warning
                  title="Update billing details"
                  description={
                    <>
                      Your usage is above the free tier,{" "}
                      <A href={`/${workspace().slug}/settings#billing`}>
                        update your billing details
                      </A>
                      .<br />
                      Note, you can continue using the Console for local stages.
                      <br />
                      Just make sure `sst dev` is running locally.
                    </>
                  }
                />
              </Fullscreen>
            </Match>
            <Match when={true}>{props.children}</Match>
          </Switch>
        </>
      );
    }}
  >
    <Route path="" component={List} />
    <Route path=":issueID" component={Detail} />
    <Route path="*" component={() => <NotFound inset="header-tabs" />} />
  </Route>
);
