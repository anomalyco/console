import { Route, Routes } from "@solidjs/router";
import { AutodeployNotFound } from "./not-found";
import { Detail } from "./detail";
import { List } from "./list";

export function Autodeploy() {
  return (
    <>
      <Routes>
        <Route path="" element={<List />} />
        <Route path=":runID" element={<Detail />} />
        <Route path="*" element={<AutodeployNotFound />} />
      </Routes>
    </>
  );
}
