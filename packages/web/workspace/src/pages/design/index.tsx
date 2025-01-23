import { Grower, Stack, Row } from "@console/web/ui/layout";
import { styled } from "@macaron-css/solid";
import {
  Input,
  Textarea,
  FormField,
  SplitOptions,
  SplitOptionsOption,
} from "@console/web/ui/form";
import { Select, MultiSelect } from "@console/web/ui/select";
import { Dropdown } from "@console/web/ui/dropdown";
import { Text } from "@console/web/ui/text";
import { Alert } from "@console/web/ui/alert";
import {
  Button,
  TabTitle,
  LinkButton,
  IconButton,
  TextButton,
  ButtonIcon,
  ButtonGroup,
  ChevronLink,
} from "@console/web/ui/button";
import { IconAdd, IconAddCircle, IconApi, IconApiGatewayV1Api, IconApp, IconAppSync, IconArrowPathSpin, IconAstroSite, IconAuth, IconAws, IconBucket, IconCaretRight, IconCaretRightOutline, IconCognito, IconConfig, IconConnect, IconConstruct, IconContainerRuntime, IconCron, IconDotNetRuntime, IconEventBus, IconFunction, IconGitHub, IconGoRuntime, IconJob, IconKinesisStream, IconLogosSlack, IconLogout, IconPythonRuntime, IconQueue, IconRDS, IconRemixSite, IconScript, IconSolidStartSite, IconStack, IconStage, IconSubRight, IconSvelteKitSite, IconTable, IconTopic, IconUserAdd, IconWebSocketApi, IconWorkspace } from "@console/web/ui/icons/custom";
import {
  JSX,
  ComponentProps,
} from "solid-js";
import { AvatarInitialsIcon } from "@console/web/ui/avatar-icon";
import { Histogram } from "@console/web/ui/histogram";
import { IconBookmark, IconCheck, IconUser } from "@console/web/ui/icons";
import { Toggle } from "@console/web/ui/switch";
import { Tag } from "@console/web/ui/tag";
import { theme } from "@console/web/ui/theme";

const ComponentRoot = styled("div", {
  base: {
    padding: theme.space[4],
  },
});

const ComponentName = styled("h1", {
  base: {
    fontSize: theme.font.size.mono_base,
    textTransform: "uppercase",
    paddingBottom: theme.space[6],
    fontFamily: theme.font.family.heading,
  },
});

const ComponentVariants = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: theme.space[4],
  },
});

const VariantRoot = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: theme.space[4],
  },
});

const VariantName = styled("h2", {
  base: {
    flex: "0 0 auto",
    fontSize: theme.font.size.mono_sm,
    textTransform: "uppercase",
    fontFamily: theme.font.family.heading,
  },
});

const VariantContent = styled("div", {
  base: {
    flex: "1 1 auto",
    display: "flex",
    flexWrap: "wrap",
    gap: theme.space[2],
    border: `1px solid ${theme.color.divider.base}`,
    padding: theme.space[4],
    borderRadius: theme.borderRadius,
  },
});

interface ComponentTypeProps {
  name: string;
  children: JSX.Element;
}

function ComponentType(props: ComponentTypeProps) {
  return (
    <ComponentRoot>
      <ComponentName>{props.name}</ComponentName>
      <ComponentVariants>{props.children}</ComponentVariants>
    </ComponentRoot>
  );
}

type VariantProps = ComponentProps<typeof VariantRoot> & {
  themes?: boolean;
  name: string;
};

function Variant(props: VariantProps) {
  return (
    <VariantRoot {...props}>
      <VariantName>{props.name}</VariantName>
      <VariantContent>{props.children}</VariantContent>
    </VariantRoot>
  );
}

const OverflowSpan = styled("span", {
  base: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});

const TextContainer = styled("div", {
  base: {
    padding: theme.space[4],
  },
  variants: {
    background: {
      base: {
        backgroundColor: theme.color.background.base,
      },
      surface: {
        backgroundColor: theme.color.background.surface,
      },
      inverted: {
        backgroundColor: theme.color.button.github.color,
      },
    },
  },
  defaultVariants: {
    background: "base",
  },
});

const IconContainer = styled("div", {
  base: {
    flex: "0 0 auto",
    width: 24,
    height: 24,
    opacity: theme.iconOpacity,
    color: theme.color.text.primary.base,
  },
});

export function Design() {
  return (
    <>
      <ComponentType name="Text">
        <Variant name="Base">
          <TextContainer background="base">
            <Text color="primary" on="base">
              TextName
            </Text>
            <Text color="secondary" on="base">
              TextName
            </Text>
            <Text color="dimmed" on="base">
              TextName
            </Text>
            <Text color="danger" on="base">
              TextName
            </Text>
          </TextContainer>
        </Variant>
        <Variant name="Surface">
          <TextContainer background="surface">
            <Text color="primary" on="surface">
              TextName
            </Text>
            <Text color="secondary" on="surface">
              TextName
            </Text>
            <Text color="dimmed" on="surface">
              TextName
            </Text>
            <Text color="danger" on="surface">
              TextName
            </Text>
          </TextContainer>
        </Variant>
        <Variant name="Inverted">
          <TextContainer background="inverted">
            <Text color="primary" on="inverted">
              TextName
            </Text>
            <Text color="secondary" on="inverted">
              TextName
            </Text>
            <Text color="dimmed" on="inverted">
              TextName
            </Text>
            <Text color="danger" on="inverted">
              TextName
            </Text>
          </TextContainer>
        </Variant>
      </ComponentType>
      <ComponentType name="Button">
        <Variant name="Primary">
          <Button color="primary">Button</Button>
          <Button data-state-hover color="primary">
            Button
          </Button>
          <Button active color="primary">
            Button
          </Button>
          <Button disabled color="primary">
            Button
          </Button>
        </Variant>
        <Variant name="Warning">
          <Button color="warning">Button</Button>
          <Button data-state-hover color="warning">
            Button
          </Button>
          <Button active color="warning">
            Button
          </Button>
          <Button disabled color="warning">
            Button
          </Button>
        </Variant>
        <Variant name="Success">
          <Button color="success">Button</Button>
          <Button data-state-hover color="success">
            Button
          </Button>
          <Button active color="success">
            Button
          </Button>
          <Button disabled color="success">
            Button
          </Button>
        </Variant>
        <Variant name="Danger">
          <Button color="danger">Button</Button>
          <Button data-state-hover color="danger">
            Button
          </Button>
          <Button active color="danger">
            Button
          </Button>
          <Button disabled color="danger">
            Button
          </Button>
        </Variant>
        <Variant name="Secondary">
          <Button color="secondary">Button</Button>
          <Button data-state-hover color="secondary">
            Button
          </Button>
          <Button active color="secondary">
            Button
          </Button>
          <Button disabled color="secondary">
            Button
          </Button>
        </Variant>
        <Variant name="GitHub">
          <Button color="github">
            <ButtonIcon>
              <IconGitHub />
            </ButtonIcon>
            Login with GitHub
          </Button>
          <Button data-state-hover color="github">
            <ButtonIcon>
              <IconGitHub />
            </ButtonIcon>
            Login with GitHub
          </Button>
          <Button active color="github">
            <ButtonIcon>
              <IconGitHub />
            </ButtonIcon>
            Login with GitHub
          </Button>
          <Button disabled color="github">
            <ButtonIcon>
              <IconGitHub />
            </ButtonIcon>
            Login with GitHub
          </Button>
        </Variant>
        <Variant name="Icon Small">
          <Button color="github" size="sm">
            <ButtonIcon size="sm">
              <IconGitHub />
            </ButtonIcon>
            Login with GitHub
          </Button>
          <Button data-state-hover color="github" size="sm">
            <ButtonIcon size="sm">
              <IconGitHub />
            </ButtonIcon>
            Login with GitHub
          </Button>
          <Button active color="github" size="sm">
            <ButtonIcon size="sm">
              <IconGitHub />
            </ButtonIcon>
            Login with GitHub
          </Button>
          <Button disabled color="github" size="sm">
            <ButtonIcon size="sm">
              <IconGitHub />
            </ButtonIcon>
            Login with GitHub
          </Button>
        </Variant>
        <Variant name="Small">
          <Button size="sm" color="primary">
            Button
          </Button>
          <Button size="sm" color="warning">
            Button
          </Button>
          <Button size="sm" color="secondary">
            Button
          </Button>
          <Button size="sm" color="success">
            Button
          </Button>
          <Button size="sm" color="danger">
            Button
          </Button>
        </Variant>
        <Variant name="Grouped">
          <ButtonGroup>
            <Button grouped="left" color="primary">
              Resolve
            </Button>
            <Button grouped="middle" color="warning">
              Resolve
            </Button>
            <Button grouped="middle" color="secondary">
              Ignore
            </Button>
            <Button grouped="middle" color="success">
              Success
            </Button>
            <Button grouped="right" color="danger">
              Remove
            </Button>
          </ButtonGroup>
        </Variant>
        <Variant name="Grouped Small">
          <ButtonGroup>
            <Button size="sm" grouped="left" color="primary">
              Resolve
            </Button>
            <Button size="sm" grouped="middle" color="warning">
              Ignore
            </Button>
            <Button size="sm" grouped="middle" color="secondary">
              Ignore
            </Button>
            <Button size="sm" grouped="middle" color="success">
              Success
            </Button>
            <Button size="sm" grouped="right" color="danger">
              Remove
            </Button>
          </ButtonGroup>
        </Variant>
      </ComponentType>
      <ComponentType name="TextButton">
        <Variant name="Base">
          <TextContainer>
            <Row space="4">
              <TextButton on="base" icon={<IconBookmark />}>
                Button
              </TextButton>
              <TextButton data-state-hover on="base" icon={<IconBookmark />}>
                Button
              </TextButton>
              <TextButton completing on="base" icon={<IconBookmark />}>
                Button
              </TextButton>
            </Row>
          </TextContainer>
        </Variant>
        <Variant name="Surface">
          <TextContainer background="surface">
            <Row space="4">
              <TextButton on="surface" icon={<IconBookmark />}>
                Button
              </TextButton>
              <TextButton data-state-hover on="surface" icon={<IconBookmark />}>
                Button
              </TextButton>
              <TextButton completing on="surface" icon={<IconBookmark />}>
                Button
              </TextButton>
            </Row>
          </TextContainer>
        </Variant>
        <Variant name="No Icon">
          <TextContainer>
            <Row space="4">
              <TextButton on="base">Button</TextButton>
              <TextButton data-state-hover on="base">
                Button
              </TextButton>
              <TextButton completing on="base">
                Button
              </TextButton>
            </Row>
          </TextContainer>
        </Variant>
      </ComponentType>
      <ComponentType name="IconButton">
        <Variant name="Base">
          <TextContainer>
            <Row space="4">
              <IconButton>
                <IconBookmark width={24} height={24} />
              </IconButton>
              <IconButton data-state-hover>
                <IconBookmark width={24} height={24} />
              </IconButton>
              <IconButton disabled>
                <IconBookmark width={24} height={24} />
              </IconButton>
            </Row>
          </TextContainer>
        </Variant>
      </ComponentType>
      <ComponentType name="LinkButton">
        <Variant name="Base">
          <TextContainer>
            <Row space="4">
              <LinkButton>Button</LinkButton>
              <LinkButton disabled>Button</LinkButton>
            </Row>
          </TextContainer>
        </Variant>
      </ComponentType>
      <ComponentType name="ChevronLink">
        <Variant name="Base">
          <TextContainer>
            <Row space="4">
              <ChevronLink href="/">Button</ChevronLink>
            </Row>
          </TextContainer>
        </Variant>
        <Variant name="Small">
          <TextContainer>
            <Row space="4">
              <ChevronLink size="sm" href="/">Button</ChevronLink>
            </Row>
          </TextContainer>
        </Variant>
      </ComponentType>
      <ComponentType name="Forms">
        <Variant name="Default">
          <Grower>
            <FormTest />
          </Grower>
        </Variant>
      </ComponentType>
      <ComponentType name="TabTitle">
        <Variant name="Base">
          <TextContainer>
            <Row space="4">
              <TabTitle state="active">Button</TabTitle>
              <TabTitle state="inactive">Button</TabTitle>
              <TabTitle state="disabled">Button</TabTitle>
            </Row>
          </TextContainer>
        </Variant>
        <Variant name="Count">
          <TextContainer>
            <Row space="4">
              <TabTitle count="4" state="active">
                Button
              </TabTitle>
              <TabTitle count="4" state="inactive">
                Button
              </TabTitle>
              <TabTitle count="4" state="disabled">
                Button
              </TabTitle>
            </Row>
          </TextContainer>
        </Variant>
        <Variant name="Indicator">
          <TextContainer>
            <Row space="4">
              <TabTitle count="•" state="active">
                Button
              </TabTitle>
              <TabTitle count="•" state="inactive">
                Button
              </TabTitle>
              <TabTitle count="•" state="disabled">
                Button
              </TabTitle>
            </Row>
          </TextContainer>
        </Variant>
        <Variant name="Long Count">
          <TextContainer>
            <Row space="4">
              <TabTitle count="41+" state="active">
                Button
              </TabTitle>
              <TabTitle count="41+" state="inactive">
                Button
              </TabTitle>
              <TabTitle count="41+" state="disabled">
                Button
              </TabTitle>
            </Row>
          </TextContainer>
        </Variant>
        <Variant name="Long Count Small">
          <TextContainer>
            <Row space="4">
              <TabTitle count="41+" state="active" size="sm">
                Button
              </TabTitle>
              <TabTitle count="41+" state="inactive" size="sm">
                Button
              </TabTitle>
              <TabTitle count="41+" state="disabled" size="sm">
                Button
              </TabTitle>
            </Row>
          </TextContainer>
        </Variant>
      </ComponentType>
      <ComponentType name="Alert">
        <Variant name="Info">
          <Grower>
            <Alert level="info">
              This is an info alert. You don't need to take it very seriously.
            </Alert>
          </Grower>
        </Variant>
        <Variant name="Danger">
          <Grower>
            <Alert level="danger">
              This is a danger alert. You need to take it very seriously.
            </Alert>
          </Grower>
        </Variant>
        <Variant name="Multi Line">
          <Grower>
            <Alert level="info">
              This is an info alert. You don't need to take it very seriously.
              But it is a long info alert that will overflow. And we want to
              test how long it can really get. So here is some more text.
            </Alert>
          </Grower>
        </Variant>
      </ComponentType>
      <ComponentType name="Tag">
        <Variant name="Solid">
          <Tag type="solid" level="info">
            Tag
          </Tag>
          <Tag type="solid" level="tip">
            Tag
          </Tag>
          <Tag type="solid" level="caution">
            Tag
          </Tag>
          <Tag type="solid" level="danger">
            Tag
          </Tag>
        </Variant>
        <Variant name="Outline">
          <Tag type="outline" level="info">
            Tag
          </Tag>
          <Tag type="outline" level="tip">
            Tag
          </Tag>
          <Tag type="outline" level="caution">
            Tag
          </Tag>
          <Tag type="outline" level="danger">
            Tag
          </Tag>
        </Variant>
        <Variant name="Icon">
          <Tag type="outline" level="info">
            <IconCheck width="11" height="11" />
          </Tag>
          <Tag type="outline" level="tip">
            <IconCheck width="11" height="11" />
          </Tag>
          <Tag type="outline" level="caution">
            <IconCheck width="11" height="11" />
          </Tag>
          <Tag type="outline" level="danger">
            <IconCheck width="11" height="11" />
          </Tag>
        </Variant>
      </ComponentType>
      <ComponentType name="AvatarInitialsIcon">
        <Variant name="Default">
          <AvatarInitialsIcon type="workspace" text="S" />
          <AvatarInitialsIcon type="workspace" text="SST" />
          <AvatarInitialsIcon type="workspace" text="Spongebob" />
          <AvatarInitialsIcon type="workspace" text="Krusty-Krab" />
          <AvatarInitialsIcon type="workspace" text="Krusty Krab" />
          <AvatarInitialsIcon type="workspace" text="Krusty___Krab" />
          <AvatarInitialsIcon type="workspace" text="Krusty.Krab" />
          <AvatarInitialsIcon type="workspace" text="1" />
          <AvatarInitialsIcon type="workspace" text="123" />
          <AvatarInitialsIcon type="workspace" text="1-2" />
          <AvatarInitialsIcon type="workspace" text="1Krusty-2Krab" />
          <AvatarInitialsIcon type="workspace" text="patrick@example.com" />
          <AvatarInitialsIcon
            type="workspace"
            text="patrick_start@example.com"
          />
          <AvatarInitialsIcon type="workspace" text="patrick2002@example.com" />
          <AvatarInitialsIcon type="workspace" text="$-_.+! *'()" />
          <AvatarInitialsIcon type="workspace" text="" />
        </Variant>
        <Variant name="User">
          <AvatarInitialsIcon type="user" text="Patrick Star" />
        </Variant>
        <Variant name="Custom Size">
          <AvatarInitialsIcon
            text="S"
            type="workspace"
            style={{ width: "48px", height: "48px" }}
          />
        </Variant>
      </ComponentType>
      <ComponentType name="Split Options">
        <Variant name="Base">
          <SplitOptions size="base">
            <SplitOptionsOption>Active</SplitOptionsOption>
            <SplitOptionsOption selected>Ignored</SplitOptionsOption>
            <SplitOptionsOption>Resolved</SplitOptionsOption>
          </SplitOptions>
        </Variant>
        <Variant name="Small">
          <SplitOptions size="sm">
            <SplitOptionsOption>Active</SplitOptionsOption>
            <SplitOptionsOption selected>Ignored</SplitOptionsOption>
            <SplitOptionsOption>Resolved</SplitOptionsOption>
          </SplitOptions>
        </Variant>
      </ComponentType>
      <ComponentType name="Select">
        <Variant name="Default">
          <Select
            options={[
              {
                label: "Default option",
                value: "1",
                seperator: true,
              },
              {
                label: "Option 1",
                value: "2",
              },
              {
                label:
                  "Super long option that should be overflow because it is so long",
                value: "3",
              },
              {
                label: "Option 3",
                value: "4",
              },
              {
                label: "Option 4",
                value: "5",
              },
            ]}
          />
        </Variant>
        <Variant name="OverflowY">
          <Select
            options={[
              { label: "1", value: "1" },
              { label: "2", value: "2" },
              { label: "3", value: "3" },
              { label: "4", value: "4" },
              { label: "5", value: "5" },
              { label: "6", value: "6" },
              { label: "7", value: "7" },
              { label: "8", value: "8" },
              { label: "9", value: "9" },
              { label: "10", value: "10" },
              { label: "11", value: "11" },
              { label: "12", value: "12" },
              { label: "13", value: "13" },
              { label: "14", value: "14" },
              { label: "15", value: "15" },
            ]}
          />
        </Variant>
      </ComponentType>
      <ComponentType name="MultiSelect">
        <Variant name="Default">
          <MultiSelect
            options={[
              {
                label: "Default option",
                value: "1",
                seperator: true,
              },
              {
                label: "Option 1",
                value: "2",
              },
              {
                label:
                  "Super long option that should be overflow because it is so long",
                value: "3",
              },
              {
                label: "Option 3",
                value: "4",
              },
              {
                label: "Option 4",
                value: "5",
              },
            ]}
          />
        </Variant>
      </ComponentType>
      <ComponentType name="Dropdown">
        <Variant name="Default">
          <Dropdown label="Dropdown">
            <Dropdown.Item>Live</Dropdown.Item>
            <Dropdown.Item>Recent</Dropdown.Item>
            <Dropdown.Seperator />
            <Dropdown.Item>Selected</Dropdown.Item>
            <Dropdown.Item>
              A really really really long dropdown option that should overflow
            </Dropdown.Item>
          </Dropdown>
          <Dropdown disabled label="Dropdown">
            <Dropdown.Item>Live</Dropdown.Item>
          </Dropdown>
        </Variant>
        <Variant name="RadioGroup">
          <Dropdown label="Dropdown">
            <Dropdown.RadioGroup value="long">
              <Dropdown.RadioItem value="live">
                <Dropdown.RadioItemLabel>Live</Dropdown.RadioItemLabel>
              </Dropdown.RadioItem>
              <Dropdown.RadioItem value="recent">
                <Dropdown.RadioItemLabel>Recent</Dropdown.RadioItemLabel>
              </Dropdown.RadioItem>
              <Dropdown.RadioItem disabled value="disabled">
                <Dropdown.RadioItemLabel>Disabled</Dropdown.RadioItemLabel>
              </Dropdown.RadioItem>
              <Dropdown.Seperator />
              <Dropdown.RadioItem value="selected">
                <Dropdown.RadioItemLabel>Selected</Dropdown.RadioItemLabel>
              </Dropdown.RadioItem>
              <Dropdown.RadioItem value="long">
                <Dropdown.RadioItemLabel>
                  A really really really long dropdown option that should
                  overflow
                </Dropdown.RadioItemLabel>
                <Dropdown.ItemIndicator>
                  <IconCheck width={14} height={14} />
                </Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            </Dropdown.RadioGroup>
          </Dropdown>
        </Variant>
        <Variant name="Sm">
          <Dropdown size="sm" label="Dropdown">
            <Dropdown.RadioGroup value="selected">
              <Dropdown.RadioItem value="live">Live</Dropdown.RadioItem>
            </Dropdown.RadioGroup>
          </Dropdown>
        </Variant>
        <Variant name="Overflow Label">
          <Dropdown
            size="base"
            label="A really really really long dropdown option that should overflow"
          >
            <Dropdown.RadioGroup value="selected">
              <Dropdown.RadioItem value="live">Live</Dropdown.RadioItem>
            </Dropdown.RadioGroup>
          </Dropdown>
        </Variant>
        <Variant name="Icon">
          <Dropdown icon={<IconBookmark width={24} height={24} />}>
            <Dropdown.Item>Live</Dropdown.Item>
          </Dropdown>
          <Dropdown disabled icon={<IconBookmark width={24} height={24} />}>
            <Dropdown.Item>Live</Dropdown.Item>
          </Dropdown>
        </Variant>
      </ComponentType>
      <ComponentType name="Switch">
        <Variant name="Base">
          <Toggle />
        </Variant>
        <Variant name="Sm">
          <Toggle size="sm" />
        </Variant>
        <Variant name="Base with Label">
          <Toggle label="Turn this on" />
        </Variant>
        <Variant name="Sm with Label">
          <Toggle size="sm" label="Turn this on" />
        </Variant>
      </ComponentType>
      <ComponentType name="Row">
        <Variant name="Default">
          <Row space="1">
            <span>Label</span>
            <span>Value</span>
          </Row>
        </Variant>
        <Variant name="Overflow">
          <Row space="1">
            <span>Label</span>
            <OverflowSpan>
              /notes/settings/absurdly/long/path/that/should/overflow/because/its/way/too/long/absurdly/long/path/that/should/overflow/because/its/way/too/long/absurdly/long/path/that/should/overflow/because/its/way/too/long
            </OverflowSpan>
          </Row>
        </Variant>
        <Variant name="No Shrink">
          <Row space="1">
            <OverflowSpan>
              /notes/settings/absurdly/long/path/that/should/overflow/because/its/way/too/long/absurdly/long/path/that/should/overflow/because/its/way/too/long/absurdly/long/path/that/should/overflow/because/its/way/too/long
            </OverflowSpan>
            <Row flex={false} space="1">
              <span>11.2 MB</span>
              <span>us-east-1</span>
            </Row>
          </Row>
        </Variant>
      </ComponentType>
      <ComponentType name="Histogram">
        <Variant name="Base">
          <Histogram
            width={320}
            height={40}
            units="Errors"
            currentTime={Date.now()}
            data={[
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 305 },
              { value: 311 },
              { value: 226 },
              { value: 200 },
              { value: 184 },
              { value: 28 },
              { value: 489 },
              { value: 1204 },
              { value: 472 },
              { value: 517 },
              { value: 25 },
            ]}
          />
        </Variant>
        <Variant name="Tooltip Top">
          <Histogram
            width={320}
            height={40}
            units="Errors"
            tooltipAlignment="top"
            currentTime={Date.now()}
            data={[
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 305 },
              { value: 311 },
              { value: 226 },
              { value: 200 },
              { value: 184 },
              { value: 28 },
              { value: 489 },
              { value: 1204 },
              { value: 472 },
              { value: 517 },
              { value: 25 },
            ]}
          />
        </Variant>
        <Variant name="0">
          <Histogram
            width={320}
            height={40}
            units="Errors"
            currentTime={Date.now()}
            data={[
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
            ]}
          />
        </Variant>
        <Variant name="01">
          <Histogram
            width={320}
            height={40}
            units="Errors"
            currentTime={Date.now()}
            data={[
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 0 },
              { value: 1 },
            ]}
          />
        </Variant>
      </ComponentType>
      <ComponentType name="Icons">
        <Variant name="Base">
          <IconContainer title="IconAdd">
            <IconAdd />
          </IconContainer>
          <IconContainer title="IconApi">
            <IconApi />
          </IconContainer>
          <IconContainer title="IconApp">
            <IconApp />
          </IconContainer>
          <IconContainer title="IconAws">
            <IconAws />
          </IconContainer>
          <IconContainer title="IconJob">
            <IconJob />
          </IconContainer>
          <IconContainer title="IconRDS">
            <IconRDS />
          </IconContainer>
          <IconContainer title="IconAuth">
            <IconAuth />
          </IconContainer>
          <IconContainer title="IconCron">
            <IconCron />
          </IconContainer>
          <IconContainer title="IconUser">
            <IconUser />
          </IconContainer>
          <IconContainer title="IconQueue">
            <IconQueue />
          </IconContainer>
          <IconContainer title="IconStack">
            <IconStack />
          </IconContainer>
          <IconContainer title="IconStage">
            <IconStage />
          </IconContainer>
          <IconContainer title="IconTable">
            <IconTable />
          </IconContainer>
          <IconContainer title="IconTopic">
            <IconTopic />
          </IconContainer>
          <IconContainer title="IconBucket">
            <IconBucket />
          </IconContainer>
          <IconContainer title="IconConfig">
            <IconConfig />
          </IconContainer>
          <IconContainer title="IconGitHub">
            <IconGitHub />
          </IconContainer>
          <IconContainer title="IconLogout">
            <IconLogout />
          </IconContainer>
          <IconContainer title="IconScript">
            <IconScript />
          </IconContainer>
          <IconContainer title="IconAppSync">
            <IconAppSync />
          </IconContainer>
          <IconContainer title="IconCognito">
            <IconCognito />
          </IconContainer>
          <IconContainer title="IconConnect">
            <IconConnect />
          </IconContainer>
          <IconContainer title="IconUserAdd">
            <IconUserAdd />
          </IconContainer>
          <IconContainer title="IconEventBus">
            <IconEventBus />
          </IconContainer>
          <IconContainer title="IconFunction">
            <IconFunction />
          </IconContainer>
          <IconContainer title="IconSubRight">
            <IconSubRight />
          </IconContainer>
          <IconContainer title="IconAddCircle">
            <IconAddCircle />
          </IconContainer>
          <IconContainer title="IconAstroSite">
            <IconAstroSite />
          </IconContainer>
          <IconContainer title="IconConstruct">
            <IconConstruct />
          </IconContainer>
          <IconContainer title="IconGoRuntime">
            <IconGoRuntime />
          </IconContainer>
          <IconContainer title="IconRemixSite">
            <IconRemixSite />
          </IconContainer>
          <IconContainer title="IconWorkspace">
            <IconWorkspace />
          </IconContainer>
          <IconContainer title="IconCaretRight">
            <IconCaretRight />
          </IconContainer>
          <IconContainer title="IconLogosSlack">
            <IconLogosSlack />
          </IconContainer>
          <IconContainer title="IconWebSocketApi">
            <IconWebSocketApi />
          </IconContainer>
          <IconContainer title="IconArrowPathSpin">
            <IconArrowPathSpin />
          </IconContainer>
          <IconContainer title="IconDotNetRuntime">
            <IconDotNetRuntime />
          </IconContainer>
          <IconContainer title="IconKinesisStream">
            <IconKinesisStream />
          </IconContainer>
          <IconContainer title="IconPythonRuntime">
            <IconPythonRuntime />
          </IconContainer>
          <IconContainer title="IconSvelteKitSite">
            <IconSvelteKitSite />
          </IconContainer>
          <IconContainer title="IconSolidStartSite">
            <IconSolidStartSite />
          </IconContainer>
          <IconContainer title="IconApiGatewayV1Api">
            <IconApiGatewayV1Api />
          </IconContainer>
          <IconContainer title="IconContainerRuntime">
            <IconContainerRuntime />
          </IconContainer>
          <IconContainer title="IconCaretRightOutline">
            <IconCaretRightOutline />
          </IconContainer>
        </Variant>
      </ComponentType>
    </>
  );
}

function FormTest() {
  return (
    <form>
      <Stack space="7">
        <FormField label="Workspace Name">
          <Input placeholder="Acme Inc." type="text" />
        </FormField>
        <FormField label="Workspace Name">
          <Input
            placeholder="Acme Inc."
            type="text"
            disabled
            value="Acme Inc."
          />
        </FormField>
        <FormField
          label="Workspace Name"
          hint="Needs to be lowercase, unique, and URL friendly."
        >
          <Input placeholder="Acme Inc." type="text" />
        </FormField>
        <FormField
          color="danger"
          label="Workspace Name"
          hint="Needs to be lowercase, unique, and URL friendly."
        >
          <Input placeholder="Acme Inc." type="text" value="Invalid Value" />
        </FormField>
        <FormField label="Workspace Description">
          <Textarea placeholder="Acme Inc." />
        </FormField>
        <FormField label="Workspace Description">
          <Textarea disabled placeholder="Acme Inc." />
        </FormField>
        <FormField
          label="Workspace Description"
          hint="Needs to be lowercase, unique, and URL friendly."
        >
          <Textarea placeholder="Acme Inc." />
        </FormField>
        <FormField
          color="danger"
          label="Workspace Description"
          hint="Needs to be lowercase, unique, and URL friendly."
        >
          <Textarea placeholder="Acme Inc.">Invalid Description</Textarea>
        </FormField>
        <FormField label="Workspace">
          <Select
            options={[
              {
                label: "Select your workspace",
                value: "1",
              },
              {
                label: "acme",
                value: "2",
              },
              {
                label: "acme-2",
                value: "3",
              },
              {
                label: "acme-3",
                value: "4",
              },
            ]}
          />
        </FormField>
        <FormField label="Workspace">
          <Select
            disabled
            options={[
              {
                label: "Select your workspace",
                value: "1",
              },
              {
                label: "acme",
                value: "2",
              },
              {
                label: "acme-2",
                value: "3",
              },
              {
                label: "acme-3",
                value: "4",
              },
            ]}
          />
        </FormField>
        <FormField
          label="Workspace"
          hint="You need to create a workspace to get started."
        >
          <Select
            options={[
              {
                label: "Select your workspace",
                value: "1",
              },
              {
                label: "acme",
                value: "2",
              },
              {
                label: "acme-2",
                value: "3",
              },
              {
                label: "acme-3",
                value: "4",
              },
            ]}
          />
        </FormField>
        <FormField
          color="danger"
          label="Workspace"
          hint="You need to create a workspace to get started."
        >
          <Select
            options={[
              {
                label: "No workspace available",
                value: "1",
              },
            ]}
          />
        </FormField>
      </Stack>
    </form>
  );
}
