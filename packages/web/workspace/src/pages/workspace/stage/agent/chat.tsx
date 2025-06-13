import { Button, ButtonIcon } from "@console/web/ui/button";
import { IconArrowRight } from "@console/web/ui/icons";
import { createSignal, For, createEffect, onMount } from "solid-js";
import { createToolCaller } from "./components/tool";
import { useApi } from "../../context";
import { useStageContext } from "../context";
import { styled } from "@macaron-css/solid";
import { theme } from "@console/web/ui/theme";
import { utility } from "@console/web/ui/utility";
import { Stack, Row } from "@console/web/ui/layout";

const ChatContainer = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: `calc(100vh - ${theme.headerHeight.root} - ${theme.headerHeight.stage})`,
    position: "relative",
    overflow: "hidden",
  },
});

const MessagesContainer = styled("div", {
  base: {
    flex: "1 1 auto",
    padding: theme.space[4],
    overflowY: "auto",
    ...utility.stack(4),
    paddingBottom: theme.space[2],
  },
});

const UserMessage = styled("div", {
  base: {
    padding: theme.space[3],
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.surface,
    fontSize: theme.font.size.sm,
    color: theme.color.text.primary.base,
    maxWidth: "80%",
    alignSelf: "flex-end",
  },
});

const AssistantMessage = styled("div", {
  base: {
    padding: theme.space[3],
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.surface,
    fontSize: theme.font.size.sm,
    color: theme.color.text.primary.base,
    maxWidth: "80%",
    alignSelf: "flex-start",
  },
});

const ToolContainer = styled("div", {
  base: {
    border: `1px solid ${theme.color.divider}`,
    borderRadius: theme.borderRadius,
    fontSize: theme.font.size.sm,
    overflow: "hidden",
  },
  variants: {
    expanded: {
      true: {
        marginBottom: theme.space[3],
      },
      false: {
        marginBottom: 0,
      },
    },
  },
});

const ToolHeader = styled("div", {
  base: {
    padding: `${theme.space[2]} ${theme.space[3]}`,
    backgroundColor: theme.color.background.surface,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

const ToolContent = styled("div", {
  base: {
    padding: theme.space[3],
    backgroundColor: theme.color.background.surface,
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    fontSize: theme.font.size.xs,
  },
});

const LoadingIndicator = styled("div", {
  base: {
    display: "flex",
    gap: theme.space[1],
    color: theme.color.text.dimmed.base,
    padding: theme.space[2],
    justifyContent: "center",
  },
});

const ClearChatButton = styled("div", {
  base: {
    display: "flex",
    justifyContent: "center",
    padding: theme.space[2],
    borderTop: `1px solid ${theme.color.divider}`,
  },
});

const ChatInputContainer = styled("div", {
  base: {
    padding: theme.space[4],
    flex: "0 0 auto",
    position: "sticky",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backdropFilter: "blur(10px)",
  },
});

const ChatInputForm = styled("div", {
  base: {
    display: "flex",
    alignItems: "flex-end",
    gap: theme.space[2],
    border: `1px solid ${theme.color.divider}`,
    borderRadius: theme.borderRadius,
    backgroundColor: theme.color.background.surface,
    padding: theme.space[2],
    maxWidth: "900px",
    margin: "0 auto",
    width: "100%",
  },
});

const ChatTextarea = styled("textarea", {
  base: {
    flex: 1,
    border: "none",
    background: "transparent",
    resize: "none",
    outline: "none",
    minHeight: "3.6875rem",
    maxHeight: "10rem",
    padding: theme.space[1],
    fontSize: theme.font.size.sm,
    color: theme.color.text.primary.base,
    "::placeholder": {
      color: theme.color.text.dimmed.base,
    },
  },
});

export function Chat() {
  const api = useApi();
  const ctx = useStageContext();
  const [messagesContainerRef, setMessagesContainerRef] = createSignal<HTMLDivElement | undefined>();
  const [isScrolledToBottom, setIsScrolledToBottom] = createSignal(true);

  // Function to check if scrolled to bottom
  const checkScrollPosition = () => {
    const container = messagesContainerRef();
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    // Consider "at bottom" if within 100px of the bottom
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsScrolledToBottom(atBottom);
  };

  // Function to scroll to bottom
  const scrollToBottom = () => {
    const container = messagesContainerRef();
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  };

  const toolCaller = createToolCaller({
    tool: {
      async list() {
        const response = await api.client.agent.mcp
          .$post({
            json: {
              stageID: ctx.stage.id,
              method: "tools/list",
              params: {},
            },
          })
          .then((r) => r.json() as any);
        return response.tools;
      },
      async call(input) {
        return await api.client.agent.mcp
          .$post({
            json: {
              stageID: ctx.stage.id,
              method: "tools/call",
              params: {
                name: input.name,
                arguments: input.arguments,
              },
            },
          })
          .then((r) => r.json() as any);
      },
    },
    generate: async (prompt) => {
      return api.client.agent.generate
        .$post({
          json: prompt,
        })
        .then((r) => r.json() as any);
    },
    onPromptUpdated: () => {
      // If user was scrolled to bottom, scroll to bottom after update
      if (isScrolledToBottom()) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(scrollToBottom, 0);
      }
    },
  });

  // Scroll to bottom on initial render
  onMount(() => {
    scrollToBottom();
  });

  // Set up scroll event listener to track if user is at bottom
  createEffect(() => {
    const container = messagesContainerRef();
    if (!container) return;

    const handleScroll = () => checkScrollPosition();
    container.addEventListener('scroll', handleScroll);
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  });

  return (
    <ChatContainer>
      <MessagesContainer ref={setMessagesContainerRef}>
        <div style={{ "max-width": "900px", "width": "100%", "margin": "0 auto" }}>
          <Stack space="4">
            <For each={toolCaller.prompt}>
              {(item) => {
                return (
                  <>
                    {item.role === "user" && item.content[0]?.type === "text" && (
                      <UserMessage>
                        {item.content[0].text}
                      </UserMessage>
                    )}
                    {item.role === "assistant" &&
                      item.content[0]?.type === "text" && (
                        <AssistantMessage>
                          {item.content[0].text}
                        </AssistantMessage>
                      )}
                    {item.role === "tool" &&
                      (() => {
                        const [expanded, setExpanded] = createSignal(false);
                        return (
                          <ToolContainer expanded={expanded()}>
                            <ToolHeader
                              onClick={() => setExpanded(!expanded())}
                            >
                              <span>{item.content[0].toolName}</span>
                              <span>{expanded() ? "-" : "+"}</span>
                            </ToolHeader>
                            {expanded() && (
                              <ToolContent>
                                {JSON.stringify(item.content[0].result, null, 2)}
                              </ToolContent>
                            )}
                          </ToolContainer>
                        );
                      })()}
                  </>
                );
              }}
            </For>
            {toolCaller.state.type === "loading" && (
              <LoadingIndicator>
                <span>■</span>
                <span>■</span>
                <span>■</span>
              </LoadingIndicator>
            )}
          </Stack>
        </div>
      </MessagesContainer>

      {toolCaller.prompt.filter((item) => item.role !== "system").length > 0 && (
        <ClearChatButton>
          <Button size="sm" color="secondary" onClick={toolCaller.clear}>
            Clear chat
          </Button>
        </ClearChatButton>
      )}

      <ChatInputContainer>
        <ChatInputForm>
          <ChatTextarea
            autofocus
            placeholder="How can I help?"
            onKeyDown={async (e) => {
              const value = e.currentTarget.value.trim();
              if (e.key === "Enter" && !e.shiftKey && value) {
                e.preventDefault();
                e.currentTarget.value = "";

                toolCaller.chat(value);
              }
            }}
            onInput={(e) => {
              const input = e.currentTarget;
              const sendButton = input.nextElementSibling as HTMLButtonElement;
              if (sendButton) {
                sendButton.disabled = !input.value.trim();
              }

              // Auto-grow
              input.style.height = "3.6875rem";
              const scrollHeight = input.scrollHeight;
              input.style.height = `${scrollHeight}px`;
            }}
          />
          <Button 
            disabled 
            color="secondary"
            onClick={(e) => {
              const textarea = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
              const value = textarea.value.trim();
              if (value) {
                textarea.value = "";
                toolCaller.chat(value);
              }
            }}
          >
            <ButtonIcon>
              <IconArrowRight />
            </ButtonIcon>
          </Button>
        </ChatInputForm>
      </ChatInputContainer>
    </ChatContainer>
  );
}
