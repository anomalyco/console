import { readFileSync, writeFileSync } from "fs";
import { postgres } from "./postgres";
import { domain } from "./dns";
import { storage } from "./storage";
import { cluster } from "./cluster";
import { auth } from "./auth";
import { database } from "./planetscale";

const conn = $interpolate`postgresql://${postgres.username}:${postgres.password}@${postgres.host}/${postgres.database}`;

const tag = $dev
  ? `latest`
  : JSON.parse(
      readFileSync("./node_modules/@rocicorp/zero/package.json").toString(),
    ).version.replace("+", "-");
const image = `registry.hub.docker.com/rocicorp/zero:${tag}`;

const zeroEnv = {
  NO_COLOR: "1",
  ZERO_UPSTREAM_DB: conn,
  ZERO_CVR_DB: conn,
  ZERO_CHANGE_DB: conn,
  ZERO_REPLICA_FILE: "/tmp/console.db",
  ZERO_SHARD_ID: $app.stage,
  ZERO_AUTH_JWKS_URL: $interpolate`${auth.url}/.well-known/jwks.json`,
  ...($dev
    ? {}
    : {
        ZERO_LITESTREAM_BACKUP_URL: $interpolate`s3://${storage.name}/zero/1`,
      }),
};

const replication = !$dev
  ? cluster.addService(`ZeroReplication`, {
      cpu: "2 vCPU",
      memory: "8 GB",
      image,
      link: [postgres, storage],
      loadBalancer: {
        rules: [
          {
            listen: "80/http",
            forward: "4849/http",
          },
        ],
        public: false,
      },
      environment: {
        ...zeroEnv,
        ZERO_SCHEMA_JSON: readFileSync(
          "./packages/zero/zero-schema.json",
        ).toString(),
        ZERO_CHANGE_MAX_CONNS: "3",
        ZERO_NUM_SYNC_WORKERS: "0",
      },
      logging: {
        retention: "1 month",
      },
    })
  : undefined;

export const zero = cluster.addService("Zero", {
  image,
  link: [postgres, storage],
  environment: {
    ...zeroEnv,
    ...($dev
      ? {
          ZERO_NUM_SYNC_WORKERS: "1",
        }
      : {
          ZERO_CHANGE_STREAMER_URI: replication!.url.apply((val) =>
            val.replace("http://", "ws://"),
          ),
          ZERO_UPSTREAM_MAX_CONNS: "15",
          ZERO_CVR_MAX_CONNS: "160",
        }),
  },
  loadBalancer: {
    domain: "zero." + domain,
    ports: [
      { listen: "443/https", forward: "4848/http" },
      { listen: "80/http", forward: "4848/http" },
    ],
  },
  dev: {
    command: "bun dev",
    directory: "packages/zero",
    url: "http://localhost:4848",
  },
});

const context = $interpolate`debezium.sink.type=http
quarkus.log.level=WARN
debezium.format.value=json
debezium.sink.http.url=http://localhost:3003
log4j.logger.io.debezium.relational.history=DEBUG, stdout
debezium.source.offset.storage.file.filename=data/offsets.dat
debezium.source.offset.flush.interval.ms=0
debezium.source.schema.history.internal=io.debezium.storage.file.history.FileSchemaHistory
debezium.source.schema.history.internal.file.filename=data/schema_history.dat
debezium.source.connector.class=io.debezium.connector.planetscale.PlanetScaleConnector
debezium.source.vitess.keyspace=sst
debezium.source.vitess.tablet.type=MASTER
debezium.source.table.include.list=sst.user,sst.state_update,sst.app,sst.workspace,sst.state_resource,sst.state_count
debezium.source.database.hostname=us-east.connect.psdb.cloud
debezium.source.database.port=443
debezium.source.database.user=${database.properties.username}
debezium.source.database.password=${database.properties.password}
debezium.source.snapshot.mode=never
debezium.source.snapshot.locking.mode=none
debezium.source.topic.prefix=connector-test
`.apply(async (val) => {
  writeFileSync("./packages/cdc/debezium/application.properties", val);
  return "./packages/cdc/debezium";
});

const cwd = process.cwd();

const cdc = cluster.addService("CDC", {
  link: [postgres, database],
  cpu: "4 vCPU",
  memory: "8 GB",
  containers: [
    {
      name: "cdc",
      image: {
        context: ".",
        dockerfile: "./packages/cdc/Dockerfile",
      },
      environment: {
        NO_COLOR: "1",
        POSTGRES_POOL_MAX: "30",
      },
      dev: {
        directory: "./packages/cdc",
        command: "bun run --hot ./src/index.ts",
      },
    },
    {
      name: "debezium",
      image: {
        context: context,
      },
      dev: {
        command: [
          "docker",
          "run",
          "--rm",
          "-it",
          "--network=host",
          "-v",
          `${cwd}/packages/cdc/debezium/application.properties:/debezium/conf/application.properties`,
          "-v",
          `${cwd}/packages/cdc/debezium/planetscale.jar:/debezium/lib/planetscale.jar`,
          "debezium/server:2.4.1.Final",
        ].join(" "),
      },
    },
  ],
});
