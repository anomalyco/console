import { Route, Routes } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";
import { AWS } from "./aws";

export function Logs() {
  return (
    <Routes>
      <Route path="" element={<List />} />
      <Route path=":resourceID/*" component={Detail} />
      <Route path="aws/*" element={<AWS />} />
      <Route path="*" element={<NotFound inset="header-tabs" />} />
    </Routes>
  );
}
