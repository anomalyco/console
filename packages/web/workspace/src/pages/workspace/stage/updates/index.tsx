import { Route, Routes } from "@solidjs/router";
import { NotFound } from "../../../not-found";
import { Detail } from "./detail";
import { List } from "./list";

export function Updates() {
  return (
    <Routes>
      <Route path="" element={<List />} />
      <Route path=":updateID" element={<Detail />} />
      <Route path="*" element={<NotFound inset="header-tabs" />} />
    </Routes>
  );
}
