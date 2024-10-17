import { z } from "zod";
import { zod } from "../util/zod";
import { App } from "octokit";
import { createTransaction, useTransaction } from "../util/transaction";
import { githubOrgTable, githubRepoTable } from "./git.sql";
import { useWorkspace } from "../actor";
import { createId } from "@paralleldrive/cuid2";
import { and, eq, ne, inArray, isNull, notInArray, or, sql } from "../drizzle";
import { createEvent } from "../event";
import { appRepoTable } from "../app/app.sql";
import { Resource } from "sst";
import { bus } from "sst/aws/bus";

export module Github {
  export const Events = {
    Installed: createEvent(
      "github.installed",
      z.object({
        installationID: z.number().int(),
      }),
    ),
  };

  export const Org = z.object({
    id: z.string().cuid2(),
    externalOrgID: z.number().int(),
    login: z.string().min(1),
    installationID: z.number().int(),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
      disconnected: z.string().optional(),
    }),
  });
  export type Org = z.infer<typeof Org>;

  export const Repo = z.object({
    id: z.string().cuid2(),
    githubOrgID: z.string().cuid2(),
    externalRepoID: z.number().int(),
    name: z.string().min(1),
    time: z.object({
      created: z.string(),
      deleted: z.string().optional(),
      updated: z.string(),
    }),
  });
  export type Repo = z.infer<typeof Repo>;

  export function serializeOrg(input: typeof githubOrgTable.$inferSelect): Org {
    return {
      id: input.id,
      externalOrgID: input.externalOrgID,
      login: input.login,
      installationID: input.installationID,
      time: {
        created: input.timeCreated.toISOString(),
        updated: input.timeUpdated.toISOString(),
        deleted: input.timeDeleted?.toISOString(),
        disconnected: input.timeDisconnected?.toISOString(),
      },
    };
  }

  export function serializeRepo(
    input: typeof githubRepoTable.$inferSelect,
  ): Repo {
    return {
      id: input.id,
      githubOrgID: input.githubOrgID,
      externalRepoID: input.externalRepoID,
      name: input.name,
      time: {
        created: input.timeCreated.toISOString(),
        updated: input.timeUpdated.toISOString(),
        deleted: input.timeDeleted?.toISOString(),
      },
    };
  }

  let client: {
    octokit: Awaited<ReturnType<typeof createClient>>;
    installationID: number;
  };
  async function useClient(installationID: number) {
    if (client?.installationID !== installationID) {
      client = {
        octokit: await createClient(installationID),
        installationID,
      };
    }
    return client.octokit;
  }
  function createClient(installationID: number) {
    const app = new App({
      appId: Resource.GithubAppID.value,
      privateKey: Resource.GithubPrivateKey.value,
    });
    return app.getInstallationOctokit(installationID);
  }

  export const connect = zod(
    Org.shape.installationID,
    async (installationID) => {
      // Get installation detail
      const client = await useClient(installationID);
      const installation = await client.rest.apps.getInstallation({
        installation_id: installationID,
      });
      const externalOrgID = installation.data.account?.id!;
      // @ts-ignore
      const login = installation.data.account?.login;

      await useTransaction(async (tx) => {
        await tx
          .insert(githubOrgTable)
          .values({
            workspaceID: useWorkspace(),
            id: createId(),
            externalOrgID,
            login,
            installationID,
          })
          .onDuplicateKeyUpdate({
            set: {
              login,
              installationID,
              timeDisconnected: null,
            },
          })
          .execute();
        const match = await tx
          .select({ id: githubOrgTable.id })
          .from(githubOrgTable)
          .where(
            and(
              eq(githubOrgTable.workspaceID, useWorkspace()),
              eq(githubOrgTable.externalOrgID, externalOrgID),
            ),
          )
          .then((x) => x[0]?.id);
        console.log("connected", match);
        if (!match) return;
        const toDelete = await tx
          .select({ id: appRepoTable.id })
          .from(appRepoTable)
          .innerJoin(
            githubRepoTable,
            eq(appRepoTable.repoID, githubRepoTable.id),
          )
          .innerJoin(
            githubOrgTable,
            eq(githubRepoTable.githubOrgID, githubOrgTable.id),
          )
          .where(
            and(
              eq(appRepoTable.workspaceID, useWorkspace()),
              ne(githubOrgTable.id, match),
            ),
          )
          .then((x) => x.map((x) => x.id));
        console.log(
          "deleting",
          toDelete.length,
          "app repos that don't match",
          match,
        );
        if (toDelete.length === 0) return;
        await tx
          .delete(appRepoTable)
          .where(
            and(
              eq(appRepoTable.workspaceID, useWorkspace()),
              inArray(appRepoTable.id, toDelete),
            ),
          );
      });
      await bus.publish(Resource.Bus, Events.Installed, { installationID });
    },
  );

  export const disconnect = zod(Org.shape.id, (id) =>
    useTransaction((tx) => {
      return tx
        .update(githubOrgTable)
        .set({
          timeDisconnected: new Date(),
        })
        .where(
          and(
            eq(githubOrgTable.id, id),
            eq(githubOrgTable.workspaceID, useWorkspace()),
          ),
        )
        .execute();
    }),
  );

  export const disconnectAll = zod(Org.shape.installationID, (installationID) =>
    useTransaction((tx) => {
      return tx
        .update(githubOrgTable)
        .set({
          timeDisconnected: new Date(),
        })
        .where(eq(githubOrgTable.installationID, installationID))
        .execute();
    }),
  );

  export const listAppReposByExternalRepoID = zod(
    Repo.shape.externalRepoID,
    (externalRepoID) =>
      useTransaction((tx) =>
        tx
          .select({
            id: appRepoTable.id,
            workspaceID: appRepoTable.workspaceID,
            appID: appRepoTable.appID,
            repoID: appRepoTable.repoID,
            path: appRepoTable.path,
          })
          .from(githubRepoTable)
          .innerJoin(
            githubOrgTable,
            and(
              eq(githubOrgTable.workspaceID, githubRepoTable.workspaceID),
              eq(githubOrgTable.id, githubRepoTable.githubOrgID),
              isNull(githubOrgTable.timeDisconnected),
            ),
          )
          .innerJoin(
            appRepoTable,
            and(
              eq(appRepoTable.workspaceID, githubRepoTable.workspaceID),
              eq(appRepoTable.type, "github"),
              eq(appRepoTable.repoID, githubRepoTable.id),
            ),
          )
          .where(eq(githubRepoTable.externalRepoID, externalRepoID))
          .execute(),
      ),
  );

  export const getExternalInfoByRepoID = zod(Repo.shape.id, (repoID) =>
    useTransaction(async (tx) =>
      tx
        .select({
          installationID: githubOrgTable.installationID,
          owner: githubOrgTable.login,
          repo: githubRepoTable.name,
        })
        .from(githubRepoTable)
        .innerJoin(
          githubOrgTable,
          and(
            eq(githubOrgTable.workspaceID, useWorkspace()),
            eq(githubOrgTable.id, githubRepoTable.githubOrgID),
          ),
        )
        .where(
          and(
            eq(githubRepoTable.id, repoID),
            eq(githubRepoTable.workspaceID, useWorkspace()),
          ),
        )
        .execute()
        .then((x) => x[0]),
    ),
  );

  export const syncRepos = zod(
    Org.shape.installationID,
    async (installationID) => {
      // get workspaces with this installation
      const orgs = await useTransaction((tx) =>
        tx
          .select()
          .from(githubOrgTable)
          .where(eq(githubOrgTable.installationID, installationID))
          .execute(),
      );
      if (orgs.length === 0) return;

      // fetch repos from GitHub
      const client = await useClient(installationID);
      const repos: { id: number; name: string }[] = [];
      for (let page = 1; ; page++) {
        const ret = await client.rest.apps.listReposAccessibleToInstallation({
          per_page: 100,
          page,
        });
        repos.push(
          ...ret.data.repositories.map((repo) => ({
            id: repo.id,
            name: repo.name,
          })),
        );
        if (ret.data.repositories.length < 100) break;
      }

      // store repos for each workspace
      await createTransaction(async (tx) => {
        await tx
          .delete(githubRepoTable)
          .where(
            or(
              ...orgs.map((org) =>
                repos.length
                  ? and(
                      eq(githubRepoTable.workspaceID, org.workspaceID),
                      eq(githubRepoTable.githubOrgID, org.id),
                      notInArray(
                        githubRepoTable.externalRepoID,
                        repos.map(({ id }) => id),
                      ),
                    )
                  : and(
                      eq(githubRepoTable.workspaceID, org.workspaceID),
                      eq(githubRepoTable.githubOrgID, org.id),
                    ),
              ),
            ),
          )
          .execute();

        if (!repos.length) return;

        await tx
          .insert(githubRepoTable)
          .values(
            orgs.flatMap((org) =>
              repos.map((repo) => ({
                id: createId(),
                workspaceID: org.workspaceID,
                githubOrgID: org.id,
                externalRepoID: repo.id,
                name: repo.name,
              })),
            ),
          )
          .onDuplicateKeyUpdate({
            set: { name: sql`VALUES(name)` },
          })
          .execute();
      });
    },
  );

  export const getFile = zod(
    z.object({
      installationID: z.number().int(),
      owner: z.string().min(1),
      repo: z.string().min(1),
      ref: z.string().min(1).optional(),
      path: z.string().min(1),
    }),
    async (input) => {
      const client = await useClient(input.installationID);
      try {
        const file = await client.rest.repos.getContent({
          owner: input.owner,
          repo: input.repo,
          ref: input.ref,
          path: input.path,
        });
        return "content" in file.data ? file.data.content : undefined;
      } catch (e: any) {}
    },
  );

  export const getCloneUrl = zod(
    z.object({
      installationID: z.number().int(),
      owner: z.string().min(1),
      repo: z.string().min(1),
    }),
    async (input) => {
      const client = await useClient(input.installationID);
      const oauthToken = await client
        .auth({ type: "installation" })
        .then((x: any) => x.token);
      return `https://oauth2:${oauthToken}@github.com/${input.owner}/${input.repo}.git`;
    },
  );
}
