import { AvatarInitialsIcon } from "$/ui/avatar-icon";
import { styled } from "@macaron-css/solid";
import { useWorkspace } from "./context";
import { utility } from "$/ui/utility";
import { Link, useNavigate } from "@solidjs/router";
import { IconArrowsRightLeft } from "$/ui/icons";
import { IconAws } from "$/ui/icons/custom";
import { Header } from "./header";
import { Fullscreen, Stack, Row } from "$/ui/layout";
import { theme } from "$/ui/theme";
import { Text } from "$/ui/text";
import { Button } from "$/ui/button";

const AddAccountGraphicAwsIcon = styled("div", {
  base: {
    width: 36,
    height: 36,
    padding: 5,
    color: "#FF9900",
    boxSizing: "border-box",
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.surface,
    border: `1px solid ${theme.color.divider.base}`,
  },
});

const AddAccountGraphicConnectIcon = styled("div", {
  base: {
    width: 16,
    height: 16,
    color: theme.color.text.dimmed.base,
  },
});

const AddAccountHint = styled("ul", {
  base: {
    ...utility.stack(2.5),
    width: "100%",
    padding: `${theme.space[4]} ${theme.space[3]} ${theme.space[4]} 30px`,
    listStyle: "circle",
    backgroundColor: theme.color.background.surface,
    borderRadius: theme.borderRadius,
    fontSize: theme.font.size.sm,
    color: theme.color.text.secondary.surface,
  },
});

const AddAccountStepsFooter = styled("div", {
  base: {
    ...utility.stack(3),
    minWidth: 360,
    paddingBottom: theme.space[5],
    borderBottom: `1px solid ${theme.color.divider.base}`,
    textAlign: "center",
    alignItems: "stretch",
  },
});

const AddAccountInvite = styled("div", {
  base: {
    ...utility.stack(2.5),
    minWidth: 360,
    textAlign: "center",
    alignItems: "stretch",
  },
});

export function Account() {
  const workspace = useWorkspace();
  const nav = useNavigate();
  return (
    <>
      <Header />
      <Fullscreen>
        <Stack space="5" vertical="center">
          <Row vertical="center" horizontal="center" space="2">
            <AvatarInitialsIcon type="workspace" text={workspace().slug} />
            <AddAccountGraphicConnectIcon>
              <IconArrowsRightLeft />
            </AddAccountGraphicConnectIcon>
            <AddAccountGraphicAwsIcon>
              <IconAws />
            </AddAccountGraphicAwsIcon>
          </Row>
          <Stack space="4">
            <Stack horizontal="center" space="2">
              <Text size="lg" weight="medium">
                Connect an AWS account
              </Text>
              <Text color="secondary">
                Let's connect an AWS account to your workspace
              </Text>
            </Stack>
            <AddAccountHint>
              <li>Load all the SST apps in your AWS account</li>
              <li>Subscribe to changes and keep them in sync</li>
              <li>
                <a
                  target="_blank"
                  href="https://docs.sst.dev/console#how-it-works"
                >
                  Learn more
                </a>{" "}
                about how the console works
              </li>
            </AddAccountHint>
            <AddAccountStepsFooter>
              <a
                target="_blank"
                onClick={() => nav(`../?force=true`)}
                href={`https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/quickcreate?region=us-east-1&param_workspaceID=${
                  workspace().id
                }&stackName=SSTConsole-${workspace().id}&templateURL=${
                  import.meta.env.VITE_CONNECT_URL
                }`}
              >
                <Button style={{ width: "100%" }} color="primary">
                  Connect an AWS Account
                </Button>
              </a>
              <Text size="sm" color="primary">
                Make sure this stack is deployed to <b>us-east-1</b>
              </Text>
            </AddAccountStepsFooter>
          </Stack>
          <AddAccountInvite>
            <Text size="sm" color="dimmed">
              Or, invite a teammate that has access to the account
            </Text>
            <Link href="../user">
              <Button style={{ width: "100%" }} color="secondary">
                Invite a Teammate
              </Button>
            </Link>
          </AddAccountInvite>
        </Stack>
      </Fullscreen>
    </>
  );
}
