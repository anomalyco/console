import { PageHeader } from "../header";
import { AutodeployDetail } from "../../../../common/autodeploy-detail";

export function Detail() {
  return (
    <>
      <PageHeader />
      <AutodeployDetail routeType="app" />
    </>
  );
}
