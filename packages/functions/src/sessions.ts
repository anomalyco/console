import { auth } from "sst/auth";

export const sessions = auth.sessions<{
  account: {
    accountID: string;
    email: string;
  };
}>();
