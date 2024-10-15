import { SSTConfig } from "sst";
import { DNS } from "./stacks/dns";
import { API } from "./stacks/api";
import { Web } from "./stacks/web";
import { Auth } from "./stacks/auth";
import { Email } from "./stacks/email";
import { Events } from "./stacks/events";
import { Issues } from "./stacks/issues";
import { Billing } from "./stacks/billing";
import { Secrets } from "./stacks/secrets";
import { Connect } from "./stacks/connect";
import { Realtime } from "./stacks/realtime";
import { Storage } from "./stacks/storage";
import { Alerts } from "./stacks/alerts";
import { Run } from "./stacks/run";

export default {
  config(input) {
    return {
      name: "console",
      region: "us-east-1",
      profile: input.stage === "production" ? "sst-production" : "sst-dev",
    };
  },
  stacks(app) {
    if (app.stage !== "production") {
      app.setDefaultRemovalPolicy("destroy");
    }
    app.setDefaultFunctionProps({
      tracing: "disabled",
      architecture: "arm_64",
      // nodejs: {
      //   sourcemap: false,
      // },
    });

    app.addDefaultFunctionEnv({
      NODE_OPTIONS: "--stack-trace-limit=100",
    });
    app
      .stack(DNS)
      .stack(Email)
      .stack(Alerts)
      .stack(Storage)
      .stack(Secrets)
      .stack(Auth)
      .stack(Events)
      .stack(Issues)
      .stack(Run)
      .stack(API)
      .stack(Realtime)
      .stack(Connect)
      .stack(Web)
      .stack(Billing);
  },
} satisfies SSTConfig;
