import type { Metadata } from "next";

import { GlobalOperationsClient } from "@/components/global-operations/global-operations-client";

import { globalSitePoints } from "./data";

export const metadata: Metadata = {
  title: "全球运营总览 - 全球指挥中心",
  description: "登录后的全球场站运行总览页面",
};

export default function GlobalOperationsPage() {
  return <GlobalOperationsClient points={globalSitePoints} />;
}
