# Event delivery

Console uses the same bus for internal delivery and customer-account forwarding.
The two paths have separate publisher requirements:

| Producer                                 | AWS principal                                                                               | Source            | Workspace resolution                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| Console functions and backend            | Console account roles with bus publishing permission                                        | `console.<stage>` | Validated actor plus live account/membership/workspace records                                     |
| Customer bootstrap bucket notifications  | EventBridge assuming `SSTConsolePublisher[-<stage>]`                                        | `aws.s3`          | AWS envelope account mapped to active account connections and workspaces                           |
| Customer deployment runner               | Runner role publishes locally; EventBridge forwards through `SSTConsolePublisher[-<stage>]` | `sst.runner`      | AWS envelope account and region matched to a live, active run and its recorded CodeBuild build ARN |
| Customer CodeBuild service notifications | EventBridge assuming `SSTConsolePublisher[-<stage>]`                                        | `aws.codebuild`   | Same run/account/region/build binding                                                              |

The customer policy requires EventBridge bus forwarding, the integration role,
and one of the three customer sources. It does not grant customer roles internal
event publishing. Consumers validate the original AWS envelope before choosing
a workspace; detail metadata is not publisher identity. An AWS account connected
to multiple workspaces remains a shared producer for those connections, as with
existing bootstrap discovery.

The integration role and forwarder names are unchanged. Existing S3 and CodeBuild
forwarders need no rule replacement. Direct customer `PutEvents` calls to the
Console bus are not supported; runner events publish to the customer's local bus.

Runner notifications include `CODEBUILD_BUILD_ARN` from the build environment.
The build script is content-versioned, so new runs use the updated format.
Notifications from older in-flight build scripts without this field are ignored;
their CodeBuild failure notifications and scheduled timeout monitoring remain
available. Deploy the updated consumers and build script together. A notification
that arrives before its build identity is recorded is retried by Lambda.

Authorization uses live records for existing bearer tokens, internal event actors,
and Slack callbacks. Pending Slack authorizations created without a user binding
must be restarted. Workspace deletion revokes memberships; the current peer
membership model still permits any active member to delete the workspace.

Configuration writes require an active app and a connected, twelve-digit AWS
account in the selected workspace. Repository connections likewise require a
live repository and installation in that workspace. Disconnected targets must be
reconnected before editing or deploying through these paths.
