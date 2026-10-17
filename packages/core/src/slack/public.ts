import { slackTeam } from "./slack.sql";
import { createSelectSchema } from "drizzle-zod";

// Client metadata is an allowlist: new server-side fields stay private.
export const publicColumns = {
  id: slackTeam.id,
  workspaceID: slackTeam.workspaceID,
  timeCreated: slackTeam.timeCreated,
  timeUpdated: slackTeam.timeUpdated,
  timeDeleted: slackTeam.timeDeleted,
  teamID: slackTeam.teamID,
  teamName: slackTeam.teamName,
};

export const PublicInfo = createSelectSchema(slackTeam).pick({
  id: true,
  workspaceID: true,
  timeCreated: true,
  timeUpdated: true,
  timeDeleted: true,
  teamID: true,
  teamName: true,
});

export function serializeTeam(
  input: Pick<typeof slackTeam.$inferSelect, keyof typeof publicColumns>,
) {
  return {
    id: input.id,
    workspaceID: input.workspaceID,
    timeCreated: input.timeCreated,
    timeUpdated: input.timeUpdated,
    timeDeleted: input.timeDeleted,
    teamID: input.teamID,
    teamName: input.teamName,
  };
}
