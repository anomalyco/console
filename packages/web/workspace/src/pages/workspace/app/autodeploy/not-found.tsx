import { PageHeader } from "../header";
import { NotFound } from "../../../not-found";

export function AutodeployNotFound() {
  return (
    <>
      <PageHeader />
      <NotFound inset="header-tabs" />
    </>
  );
}

