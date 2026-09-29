"use client";

import { useState } from "react";
import { PropertiesTable, type PropertyRow } from "./PropertiesTable";
import { PropertyDetailsDrawer } from "./PropertyDetailsDrawer";
import { PropertiesCardGrid } from "./PropertiesCardGrid";

export function PropertiesListWrapper({ rows, view = "list" }: { rows: PropertyRow[]; view?: "list" | "cards" }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      {view === "cards" ? <PropertiesCardGrid rows={rows} onSelectProperty={setSelectedId} /> : <PropertiesTable rows={rows} onSelectProperty={setSelectedId} />}
      <PropertyDetailsDrawer propertyId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
