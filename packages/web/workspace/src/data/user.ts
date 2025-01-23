import type { User } from "@console/core/user/index";
import { Store } from "./store";

export const UserStore = new Store()
  .type<User.Info>()
  .get((userID: string) => [`user`, userID])
  .scan("list", () => [`user`])
  .build();
