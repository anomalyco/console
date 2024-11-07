import { Route, Routes } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { PageHeader } from "../header";
import { Detail } from "./detail";
import { List } from "./list";

export function Autodeploy() {
  return (
    <>
      <PageHeader />
      <Routes>
        <Route path="" element={<List />} />
        <Route path=":runID" element={<Detail />} />
        <Route path="*" element={<NotFound inset="header-tabs" />} />
      </Routes>
    </>
  );
}
